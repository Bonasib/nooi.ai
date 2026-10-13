# Content localization (v78b — NVIDIA's Content Localization blueprint inside nooi), end to end on a fresh server with its own
# data + media and mocked engines: a text AI (Anthropic Messages format), ElevenLabs (Scribe speech-to-text with speakers,
# text-to-speech, Dubbing, instant voice clones), CAMB.AI (upload → dub → alt-format) and a real gRPC server that speaks the
# blueprint's protos (nvidia.ai4m.controller.v1.ContentLocalizationController + grpc.health.v1). ffmpeg makes a 12 s video.
# API: engines & best-value quotes · transcript with speakers · nooi natural voices (cast per speaker, fitted, mixed, subtitles,
# quality check, library item) · ElevenLabs Dubbing · CAMB.AI · NVIDIA full (S2S + speaker rows + lip-sync) and lip-sync-only
# (translated audio) · own voices with consent (clones removed after) · failures · health · natural-voice tool · Video
# intelligence hears the speech · private addresses refused.
# UI (phone in Arabic + desktop): transcribe into lines → Dubbing tab (engines with prices, best value) → dub → results →
# edit the lines · open in editor · publish · analyse; Video intelligence → Translate & dub; admin provider cards.
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, LPORT, GPORT = 8061, 8062, 8063
D = tempfile.mkdtemp(prefix="nooi-loc-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": [], "posts": {}, "accounts": {}}}}, open(D + "/data/db.json", "w"))
FF = os.environ.get("FFMPEG_PATH", "ffmpeg")
VID = D + "/media/talk.mp4"; MUTE = D + "/media/mute.mp4"
subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=12", "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=44100:duration=12",
                "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", VID], check=True)
subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=25:duration=3", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", MUTE], check=True)
for sec in (1, 2, 3, 12):   # the mocked voices: real MP3s of a few lengths
    subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-i", f"sine=frequency=330:sample_rate=44100:duration={sec}", "-c:a", "libmp3lame", "-b:a", "64k", f"{D}/tone{sec}.mp3"], check=True)
MOCK = r"""
const http=require('http'),fs=require('fs'),path=require('path');const D=process.argv[4];
const st={llm:0,translate:[],qa:0,ear:0,said:0,stt:[],tts:[],dub:[],dubPolls:0,clones:[],deleted:[],camb:[],put:0};
const W=(t,s,e,spk)=>({text:t,start:s,end:e,type:'word',speaker_id:'speaker_'+spk});
const LINES=[['Hello and welcome to our studio.',.5,2.6,0],['Thanks, it is great to be here.',3.0,5.2,1],['Today we show you three new tools.',6.0,8.4,0],["Let's start with the first one.",9.0,11.0,1]];
const words=[];for(const [t,s,e,spk] of LINES){const ws=t.split(' '),d=(e-s)/ws.length;ws.forEach((w,i)=>{words.push(W(w,+(s+i*d).toFixed(2),+(s+(i+1)*d-.02).toFixed(2),spk));if(i<ws.length-1)words.push({text:' ',start:0,end:0,type:'spacing'})})}
const mp3=(sec)=>fs.readFileSync(path.join(D,'tone'+sec+'.mp3'));
const body=(q)=>new Promise(r=>{const c=[];q.on('data',x=>c.push(x));q.on('end',()=>r(Buffer.concat(c)))});
const field=(b,name)=>{const m=new RegExp('name="'+name+'"\\r\\n\\r\\n([^\\r]*)').exec(b.toString('latin1'));return m?m[1]:null};
const dubs={};let camb={};
http.createServer(async(q,s)=>{const b=await body(q),u=q.url,J=(o,c)=>{s.statusCode=c||200;s.setHeader('content-type','application/json');s.end(JSON.stringify(o))};
 if(u==='/stats')return J(st);
 if(u==='/v1/messages'){st.llm++;const j=JSON.parse(b);const c=j.messages[0].content,t=Array.isArray(c)?c.find(x=>x.type==='text').text:c;let o={};
  if(/professional dubbing translator/.test(t)){const into=/into ([A-Za-z]+)/.exec(t)[1],arr=JSON.parse(t.slice(t.indexOf('LINES: ')+7,t.indexOf('\nReturn')));st.translate.push({into,n:arr.length,max:arr.map(x=>x.max),gloss:/glossary/.test(t)});
   const mk={Spanish:'Hola',Arabic:'مرحبا',French:'Bonjour',German:'Hallo',Italian:'Ciao'}[into]||into;o={lines:arr.map(x=>({i:x.i,text:mk+' '+x.text.split(' ').slice(0,4).join(' '),emotion:x.i%2?'warm':'excited'})),speakers:{'0':'female','1':'male'}}}
  else if(/Quality check of a dub/.test(t)){st.qa++;const arr=JSON.parse(t.slice(t.indexOf('ITEMS: ')+7,t.indexOf('\nReturn')));o={items:arr.map(x=>({i:x.i,back:x.original,score:x.i===1?.4:.95,note:x.i===1?'the number changed':''}))}}
  else if(/sound like a real person/.test(t)){st.ear++;const arr=JSON.parse(t.slice(t.indexOf('LINES: ')+7,t.indexOf('\nReturn')));o={lines:arr.map(x=>({i:x.i,text:x.text.replace('do not',"don't"),emotion:'warm'}))}}
  else if(/contact sheet of 4 frames/.test(t)){if(/What is said in this part/.test(t))st.said++;o={caption:'A test pattern while two people talk.',objects:['screen'],tags:['studio'],events:[]}}
  else if(/^Search query:/.test(t)){const lines=t.split('\n').filter(l=>/^\d+\. /.test(l));o={matches:lines.map(l=>({i:+l.split('.')[0],score:/three new tools/.test(l)?.9:.1,why:'said'}))}}
  else if(/Aggregate them/.test(t))o={title:'Studio talk',summary:'Two people talk in a studio.',highlights:[{t:0,text:'Welcome'}],timeline:[{s:0,e:12,text:'Talk'}],alerts:[],report:'# Overview'};
  return J({content:[{type:'text',text:JSON.stringify(o)}]})}
 // ElevenLabs
 if(u==='/el/v1/speech-to-text'){st.stt.push({model:field(b,'model_id'),diarize:field(b,'diarize'),gran:field(b,'timestamps_granularity'),key:q.headers['xi-api-key']});return J({language_code:'eng',text:LINES.map(x=>x[0]).join(' '),words})}
 let m=/^\/el\/v1\/text-to-speech\/([^?]+)\?output_format=(.*)$/.exec(u);
 if(m){const j=JSON.parse(b);st.tts.push({voice:decodeURIComponent(m[1]),model:j.model_id,prev:!!j.previous_text,next:!!j.next_text,lang:j.language_code||null,stab:j.voice_settings&&j.voice_settings.stability,text:j.text});s.setHeader('content-type','audio/mpeg');return s.end(mp3(j.text.length>40?3:j.text.length>18?2:1))}
 if(u==='/el/v1/voices/add'){const id='clone'+(st.clones.length+1);st.clones.push(id);return J({voice_id:id})}
 m=/^\/el\/v1\/voices\/(.+)$/.exec(u);if(m&&q.method==='DELETE'){st.deleted.push(m[1]);return J({status:'ok'})}
 if(u==='/el/v1/dubbing'&&q.method==='POST'){const id='dub'+(st.dub.length+1);st.dub.push({id,target:field(b,'target_lang'),source:field(b,'source_lang'),noClone:field(b,'disable_voice_cloning'),dropBg:field(b,'drop_background_audio'),mode:field(b,'mode'),file:/filename="audio.mp3"/.test(b.toString('latin1'))});dubs[id]=0;return J({dubbing_id:id,expected_duration_sec:2})}
 m=/^\/el\/v1\/dubbing\/([^/]+)$/.exec(u);if(m){st.dubPolls++;dubs[m[1]]++;return J({dubbing_id:m[1],status:dubs[m[1]]>1?'dubbed':'dubbing',target_languages:['de']})}
 m=/^\/el\/v1\/dubbing\/([^/]+)\/audio\/([a-z]+)$/.exec(u);if(m){s.setHeader('content-type','audio/mpeg');return s.end(mp3(12))}
 m=/^\/el\/v1\/dubbing\/([^/]+)\/transcript\/([a-z]+)\?format_type=srt$/.exec(u);if(m){s.setHeader('content-type','text/plain');return s.end('1\n00:00:00,500 --> 00:00:02,600\nHallo und willkommen in unserem Studio.\n\n2\n00:00:03,000 --> 00:00:05,200\nDanke, schön hier zu sein.\n')}
 if(u==='/el/v1/models')return J([]);
 // CAMB.AI
 if(u==='/camb/files/upload-url'){const j=JSON.parse(b);st.camb.push(['upload',j.filename,j.content_type,q.headers['x-api-key']]);return J({file:{file_id:'f1'},upload:{url:'http://localhost:'+process.argv[2]+'/camb-put/f1',headers:{'x-test':'1'}}})}
 if(u==='/camb-put/f1'){st.put=b.length;st.camb.push(['put',q.headers['x-test']]);s.statusCode=200;return s.end()}
 if(u==='/camb/files/f1/complete'){st.camb.push(['complete']);return J({})}
 if(u==='/camb/dub'){const j=JSON.parse(b);st.camb.push(['dub',j.source_language,j.target_languages,j.ai_optimization]);camb={n:0,fail:j.target_languages[0]===87};return J({task_id:'t1'})}
 if(u==='/camb/dub/t1'){camb.n++;return J(camb.n<2?{status:'PENDING'}:camb.fail?{status:'ERROR',message:'voice model unavailable'}:{status:'SUCCESS',run_id:42})}
 m=/^\/camb\/dub-alt-format\/42\/(\d+)$/.exec(u);if(m){st.camb.push(['alt',+m[1],JSON.parse(b).output_format]);return J({task_id:'alt1'})}
 if(u==='/camb/dub-alt-format/alt1')return J({status:'SUCCESS',output_url:'http://localhost:'+process.argv[2]+'/camb-file.mp3'});
 if(u==='/camb-file.mp3'){s.setHeader('content-type','audio/mpeg');return s.end(mp3(12))}
 if(u==='/camb/source-languages')return J([{id:1}]);
 J({error:'not found '+u},404)}).listen(+process.argv[2]);
// the blueprint's controller over gRPC: records what nooi sends and streams the video back
const grpc=require('@grpc/grpc-js'),pl=require('@grpc/proto-loader');const dir=process.argv[5];
const def=pl.loadSync(['nvidia/ai4m/controller/v1/controller.proto','health.proto'],{includeDirs:[dir],keepCase:true,longs:String,enums:Number,defaults:false,oneofs:true});const pkg=grpc.loadPackageDefinition(def);
const G=st.grpc=[];const srv=new grpc.Server();
srv.addService(pkg.nvidia.ai4m.controller.v1.ContentLocalizationController.service,{StreamContentLocalization(call){const rec={order:[],audio:0,audioBytes:0,header:null,video:0,diar:0,diarMax:0,translated:0,cfg:{},rid:new Set(),auth:call.metadata.get('authorization')[0]||null};G.push(rec);const vid=[];
  call.on('data',m=>{const k=m.payload;rec.rid.add(m.request_id);if(rec.order[rec.order.length-1]!==k)rec.order.push(k);
   if(k==='audio_data'){if(!rec.audio)rec.header=m.audio_data.slice(0,4).toString()+':'+m.audio_data.length;rec.audio++;rec.audioBytes+=m.audio_data.length}
   else if(k==='video_file_data'){rec.video+=m.video_file_data.length;vid.push(m.video_file_data)}else if(k==='diarization_info'){rec.diar++;rec.diarMax=Math.max(rec.diarMax,m.diarization_info.segments.length)}else if(k==='translated_audio_data')rec.translated++;else rec.cfg[k]=m[k]});
  call.on('end',()=>{rec.rid=[...rec.rid];call.write({request_id:rec.rid[0],keepalive:{}});const all=Buffer.concat(vid);for(let i=0;i<all.length;i+=200000)call.write({request_id:rec.rid[0],video_file_data:all.subarray(i,i+200000)});call.end()})}});
srv.addService(pkg.grpc.health.v1.Health.service,{Check(c,cb){cb(null,{status:1})},Watch(c){c.end()}});
srv.bindAsync('127.0.0.1:'+process.argv[3],grpc.ServerCredentials.createInsecure(),()=>{});
"""
open(D + "/mock.js", "w").write(MOCK)
fails = []
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, method=None, port=None):
    req = urllib.request.Request(f"http://localhost:{port or PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method=method or ("POST" if body is not None else "GET"), headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e: return {"_status": e.code, **json.loads(e.read() or b"{}")}
def stats(): return json.loads(urllib.request.urlopen(f"http://localhost:{LPORT}/stats").read())
def wait(rec, sec=90):
    t0 = time.time()
    while rec.get("status") == "running" and time.time() - t0 < sec: time.sleep(.3); rec = api("/v1/localize/" + rec["id"])
    return rec
def probe(url):
    f = D + "/media/" + url.split("/")[-1]; o = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", f], capture_output=True, text=True)
    j = json.loads(o.stdout or "{}"); return {"dur": float(j.get("format", {}).get("duration", 0)), "v": any(s["codec_type"] == "video" for s in j.get("streams", [])), "a": any(s["codec_type"] == "audio" for s in j.get("streams", []))}
def media_text(url): return open(D + "/media/" + url.split("/")[-1], encoding="utf-8").read()
out = {}

def api_checks():
    L = api("/v1/localize"); e = L.get("engines", {})
    ok(e.get("nooi") and e.get("elevenlabs") and e.get("camb") and e.get("nvidia") and e.get("stt"), f"all engines connected {e}")
    ok(L.get("price", {}).get("voice", 0) > L.get("price", {}).get("stt", 0) > 0, f"prices {L.get('price')}")
    q = api("/v1/localize/quote", {"dur": 12, "targets": ["es", "fr"], "opts": {}}); c = {r["id"]: r for r in q["engines"]}
    ok(q["pick"] == "nooi" and q["why"] == "cheapest" and c["nooi"]["credits"] < c["camb"]["credits"] < c["elevenlabs"]["credits"], f"best value = cheapest {q['pick']} {[(r['id'], r['credits']) for r in q['engines']]}")
    q = api("/v1/localize/quote", {"dur": 12, "targets": ["es"], "opts": {"lipsync": True}}); ok(q["pick"] == "nvidia" and q["why"] == "lips", f"lip-sync → NVIDIA {q['pick']}")
    q = api("/v1/localize/quote", {"dur": 12, "targets": ["es"], "opts": {"voice": "clone"}}); c = {r["id"]: r for r in q["engines"]}
    ok(q["pick"] == "camb" and not c["nooi"]["ok"] and "consent" in c["nooi"]["reason"], f"own voices without consent → cheapest dubbing service {q['pick']} {c['nooi']['reason']}")
    q = api("/v1/localize/quote", {"dur": 12, "targets": ["sw"], "opts": {}, "engine": "elevenlabs"}); ok(q["pick"] == "elevenlabs" and not q["engines"][2]["ok"] and "Swahili" in q["engines"][2]["reason"], f"language support {q['engines'][2]}")
    out["quote"] = [(r["id"], r["credits"]) for r in api("/v1/localize/quote", {"dur": 12, "targets": ["es", "fr"], "opts": {}})["engines"]]
    # transcript with speakers
    t = wait(api("/v1/localize/transcribe", {"src": "/media/talk.mp4", "title": "talk", "srcLang": "auto"}))
    ok(t["status"] == "complete" and len(t["lines"]) == 4 and {l["spk"] for l in t["lines"]} == {0, 1} and t["detected"] == "en", f"transcript {t.get('status')} {t.get('error')} {[(l['s'], l['spk'], l['text']) for l in t.get('lines', [])]}")
    s = stats()["stt"]; ok(s and s[0]["model"] == "scribe_v2" and s[0]["diarize"] == "true" and s[0]["gran"] == "word" and s[0]["key"] == "el-test", f"Scribe request {s[:1]}")
    # nooi natural voices into Spanish + Arabic
    r = wait(api("/v1/localize", {"src": "/media/talk.mp4", "title": "talk", "srcLang": "en", "targets": ["es", "ar"], "engine": "nooi", "dur": 12, "opts": {"glossary": "studio = estudio"}}), 120)
    out["nooi"] = {k: (v["status"], v.get("error")) for k, v in r.get("out", {}).items()}
    ok(r["status"] == "complete" and all(v["status"] == "done" for v in r["out"].values()), f"nooi dub {r.get('status')} {r.get('error')} {out['nooi']}")
    if r["status"] == "complete":
        es = r["out"]["es"]; p = probe(es["video"])
        ok(abs(p["dur"] - 12) < .7 and p["v"] and p["a"], f"Spanish video {p}")
        ok(es["srt"] and "Hola" in media_text(es["srt"]) and media_text(es["vtt"]).startswith("WEBVTT"), "Spanish subtitles")
        ok(es["qa"] and es["qa"]["meaning"] is not None and len(es["qa"]["flagged"]) == 1 and es["qa"]["file"]["ok"], f"quality check {es.get('qa')}")
        ok(es["voices"] and len(set(es["voices"].values())) == 2, f"one voice per speaker {es.get('voices')}")
        tts = stats()["tts"]; v0 = {x["voice"] for x in tts if x["text"].startswith("Hola Hello") or x["text"].startswith("Hola Today")}; v1 = {x["voice"] for x in tts if x["text"].startswith("Hola Thanks") or x["text"].startswith("Hola Let")}
        ok(len(v0) == 1 and len(v1) == 1 and v0 != v1, f"speaker voices steady {v0} {v1}")
        ok(any(x["prev"] for x in tts) and all(x["model"] == "eleven_multilingual_v2" for x in tts), "lines flow (previous_text) on Multilingual v2")
        ok(any(x["text"].startswith("مرحبا") for x in tts), "Arabic lines spoken")
        tr = stats()["translate"]; ok(any(t["into"] == "Arabic" for t in tr) and all(t["gloss"] for t in tr) and all(m > 0 for t in tr for m in t["max"]), f"translation with time budgets + glossary {tr[:1]}")
        jobs = api("/v1/jobs")["jobs"]; ok(sum(1 for j in jobs if j["kind"] == "dub" and j["url"]) >= 2, "dubs land in the library")
        steps = {s["k"]: s["st"] for s in r["steps"]}; ok(steps["transcript"] == "done" and steps["voice"] == "done" and steps["qa"] == "done", f"steps {steps}")
    # ElevenLabs Dubbing into German
    r = wait(api("/v1/localize", {"src": "/media/talk.mp4", "title": "talk", "srcLang": "en", "targets": ["de"], "engine": "elevenlabs", "dur": 12, "opts": {"qa": False}}))
    ok(r["status"] == "complete" and r["out"]["de"]["video"], f"ElevenLabs dub {r.get('status')} {r.get('error')} {r.get('out')}")
    d = stats()["dub"]; ok(d and d[-1]["target"] == "de" and d[-1]["source"] == "en" and d[-1]["noClone"] == "true" and d[-1]["mode"] == "automatic" and d[-1]["dropBg"] == "false" and d[-1]["file"], f"dubbing request {d[-1:]}")
    if r["status"] == "complete": ok(len(r["out"]["de"]["lines"]) == 2 and "Hallo" in r["out"]["de"]["lines"][0]["text"], f"ElevenLabs transcript → lines {r['out']['de']['lines']}")
    # CAMB.AI into Spanish (and a failing language → refunded, reported)
    r = wait(api("/v1/localize", {"src": "/media/talk.mp4", "title": "talk", "srcLang": "en", "targets": ["es", "it"], "engine": "camb", "dur": 12, "opts": {"qa": False, "subtitles": False}}))
    cs = stats()["camb"]; ok(r["out"]["es"]["status"] == "done" and r["out"]["it"]["status"] == "failed" and "voice model unavailable" in (r["out"]["it"]["error"] or ""), f"CAMB.AI {r['out']}")
    ok(["upload", "audio.mp3", "audio/mpeg", "camb-test"] in cs and ["put", "1"] in cs and ["complete"] in cs and ["dub", 1, [54], True] in cs and ["alt", 54, "mp3"] in cs and stats()["put"] > 1000, f"CAMB.AI calls {cs}")
    # NVIDIA controller: full blueprint pass (S2S + speaker rows + lip-sync)
    r = wait(api("/v1/localize", {"src": "/media/talk.mp4", "title": "talk", "srcLang": "en", "targets": ["es"], "engine": "nvidia", "dur": 12, "opts": {"lipsync": True, "qa": False}}))
    g = stats()["grpc"]; ok(r["status"] == "complete" and g, f"NVIDIA full {r.get('status')} {r.get('error')}")
    if g:
        x = g[-1]; out["grpc"] = {k: x[k] for k in ("order", "audio", "header", "video", "diar", "diarMax", "translated", "auth")}
        ok(x["order"][:4] == ["controller_config", "asd_config", "lipsync_config", "s2s_config"], f"configs first {x['order'][:5]}")
        ok(x["cfg"]["controller_config"]["bypass_s2s"] is False and x["cfg"]["controller_config"]["bypass_asd"] is False and x["cfg"]["controller_config"]["input_audio_config"]["encoding"] == 2, f"controller config {x['cfg'].get('controller_config')}")
        ok(x["cfg"]["s2s_config"]["source_language"] == "en" and x["cfg"]["s2s_config"]["target_language"] == "es", f"S2S config {x['cfg'].get('s2s_config')}")
        ok(x["header"] == "RIFF:44" and x["audio"] >= 12 and x["video"] > 10000 and x["diar"] >= 1 and 0 < x["diarMax"] <= 10 and x["translated"] == 0, f"streams {out['grpc']}")
        ok(x["cfg"]["lipsync_config"]["input_audio_codec"] == 1 and x["cfg"]["lipsync_config"]["is_speaker_info_provided"] is True and x["auth"] == "Bearer nv-tok", f"lip-sync config {x['cfg'].get('lipsync_config')} {x['auth']}")
        p = probe(r["out"]["es"]["video"]) if r["status"] == "complete" else {}; ok(p.get("v"), f"NVIDIA video back {p}")
    # NVIDIA lip-sync only: nooi voices, translated audio over gRPC
    api("/v1/admin/providers/nvloc", {"model": "lipsync"}, "PUT")
    r = wait(api("/v1/localize", {"src": "/media/talk.mp4", "title": "talk", "srcLang": "en", "targets": ["fr"], "engine": "nvidia", "dur": 12, "opts": {"lipsync": True, "qa": False}}), 120)
    g = stats()["grpc"]; x = g[-1] if g else {}
    ok(r["status"] == "complete" and x.get("cfg", {}).get("controller_config", {}).get("bypass_s2s") is True and "s2s_config" not in x.get("cfg", {}) and x.get("translated", 0) >= 12 and x["cfg"]["lipsync_config"]["input_audio_codec"] == 2, f"NVIDIA lip-sync only {r.get('status')} {r.get('error')} {x.get('order')}")
    if r["status"] == "complete": p = probe(r["out"]["fr"]["video"]); ok(p["v"] and p["a"] and abs(p["dur"] - 12) < .7, f"lip-synced video with the nooi mix {p}")
    api("/v1/admin/providers/nvloc", {"model": "elevenlabs"}, "PUT")
    h = api("/v1/admin/providers/nvloc/test", {}); ok(h.get("state") == "online", f"NVIDIA health check {h}")
    # the speakers' own voices (consent) with nooi voices: one clone per speaker, removed afterwards
    bad = api("/v1/localize", {"src": "/media/talk.mp4", "srcLang": "en", "targets": ["es"], "engine": "nooi", "dur": 12, "opts": {"voice": "clone"}}); ok(bad.get("_status") == 400 and "consent" in bad.get("error", ""), f"consent required {bad}")
    r = wait(api("/v1/localize", {"src": "/media/talk.mp4", "title": "talk", "srcLang": "en", "targets": ["es"], "engine": "nooi", "dur": 12, "opts": {"voice": "clone", "consent": True, "qa": False}}), 120)
    s = stats(); ok(r["status"] == "complete" and len(s["clones"]) == 2 and sorted(s["deleted"]) == sorted(s["clones"]) and {x["voice"] for x in s["tts"][-4:]} <= set(s["clones"]), f"own voices {r.get('status')} {r.get('error')} clones {s['clones']} deleted {s['deleted']}")
    # failures: no sound · private address · nothing connected for an engine
    r = wait(api("/v1/localize", {"src": "/media/mute.mp4", "srcLang": "en", "targets": ["es"], "engine": "nooi", "dur": 3})); ok(r["status"] == "failed" and "no sound" in (r["error"] or ""), f"no sound {r.get('error')}")
    r = wait(api("/v1/localize", {"src": "http://127.0.0.1:22/x.mp4", "srcLang": "en", "targets": ["es"], "engine": "nooi", "dur": 3})); ok(r["status"] == "failed" and "can't be used" in (r["error"] or ""), f"private address refused {r.get('error')}")
    # the natural-voice tool
    v = api("/v1/voice/natural", {"lines": [{"text": "We do not stop here.", "speaker": 0}, {"text": "Then let us keep going!", "speaker": 1, "gender": "male"}], "lang": "en"})
    ok(v.get("url") and v.get("dur", 0) > 1 and len(set(v.get("voices", {}).values())) == 2 and stats()["ear"] >= 1 and "don't" in v["lines"][0]["text"], f"natural voice {v}")
    if v.get("url"): p = probe(v["url"]); ok(p["a"], f"natural voice file {p}")
    # Video intelligence hears the speech
    rec = api("/v1/vss", {"src": "/media/talk.mp4", "title": "talk", "chunk": 6, "audio": True})
    for _ in range(80):
        rec = api("/v1/vss/" + rec["id"])
        if rec["status"] != "running": break
        time.sleep(.3)
    ok(rec["status"] == "complete" and rec.get("speechBy") == "elevenlabs" and any("welcome" in (c.get("speech") or "") for c in rec["chunks"]) and stats()["said"] >= 1, f"VSS hears the speech {rec.get('status')} {rec.get('error')} {[c.get('speech') for c in rec.get('chunks', [])]}")
    sr = api("/v1/vss/search", {"q": "three new tools"}); ok(any(h["s"] >= 6 for h in sr.get("results", [])), f"search finds spoken words {sr}")

async def ui(p, w):
    mob = w < 800; tag = "phone" if mob else "desktop"; r = {}
    b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    ctx = await b.new_context(viewport={"width": w, "height": 860}, is_mobile=mob, has_touch=mob)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); E = pg.evaluate
    async def wait_for(js, sec=30):
        for _ in range(sec * 4):
            if await E(js): return True
            await asyncio.sleep(.25)
        return False
    await E("()=>{window.__t=[];const t0=toast;toast=function(m,o){window.__t.push(String(m));return t0.apply(this,arguments)};S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='%s';S.user={name:'T',method:'google'};AU.showAuth=false;S.subs=defaultSubs();S.subs.srcLang='en';go('subs');renderAll()}" % ("ar" if mob else "en"))
    await pg.set_input_files("input[data-subsfile]", VID); await pg.wait_for_timeout(800)
    await E("()=>document.querySelector('[data-act=subs-transcribe]').click()")
    ok(await wait_for("()=>S.subs.segs.length===4", 40), f"{tag}: transcript → 4 lines " + str(await E("()=>window.__t")))
    r["segs"] = await E("()=>S.subs.segs.map(s=>[Math.round(s.start*10)/10,s.spk,s.text.en])"); ok(r["segs"] and r["segs"][1][1] == 1, f"{tag}: speakers kept {r['segs']}")
    await E("()=>{S.subs.tab='dub';S.subs.dub.langs=['es'];S.subs.dub.voice='library';S.subs.dub.lipsync=false;S.loc.eng='auto';S.loc.qa=true;renderView()}")
    ok(await wait_for("()=>document.querySelectorAll('#locq .locrow').length===5&&!document.querySelector('#locgo').disabled", 20), f"{tag}: engines priced, button ready")
    r["quote"] = await E("()=>[LOCD.quote.pick,[...document.querySelectorAll('#locq .locrow')].map(c=>c.textContent.slice(0,40)),(document.querySelector('#locgo .cost')||{}).textContent||'',document.querySelectorAll('#locq .locrow[aria-pressed=true]').length]")
    ok(r["quote"][0] == "nooi" and r["quote"][2].strip().startswith("38") and r["quote"][3] == 1, f"{tag}: best value {r['quote']}")
    await E("()=>document.querySelector('#locq .locrow[data-v=camb]').click()")
    ok(await wait_for("()=>LOCD.quote&&LOCD.quote.pick==='camb'&&(document.querySelector('#locgo .cost')||{}).textContent==='73 cr'", 10) or await wait_for("()=>LOCD.quote&&LOCD.quote.pick==='camb'", 5), f"{tag}: picking an engine re-prices")
    await E("()=>document.querySelector('#locq .locrow[data-v=auto]').click()")
    ok(await wait_for("()=>LOCD.quote&&LOCD.quote.pick==='nooi'&&!document.querySelector('#locgo').disabled", 10), f"{tag}: back to best value")
    await E("()=>{S.loc.sel=null;document.querySelector('#locgo').click()}")
    if not await wait_for("()=>{const x=S.loc.sel&&LOCD.items.find(y=>y.id===S.loc.sel);return !!x&&x.status!=='running'}", 90):
        ok(False, f"{tag}: dub finished " + str(await E("()=>window.__t"))); await b.close(); return r
    await pg.wait_for_timeout(600)
    r["result"] = await E("()=>{const x=LOCD.items.find(y=>y.id===S.loc.sel);return [x.status,x.engine,x.out.es&&x.out.es.status,!!document.querySelector('#locruns video.locvid'),!!document.querySelector('#locruns .locqa'),document.querySelectorAll('#locruns [data-act^=loc-]').length]}")
    ok(r["result"][0] == "complete" and r["result"][1] == "nooi" and r["result"][2] == "done" and r["result"][3] and r["result"][4] and r["result"][5] >= 5, f"{tag}: result card {r['result']}")
    if os.environ.get("SHOT_DIR"):
        await E("()=>{const d=document.querySelector('#locruns');d&&d.scrollIntoView()}"); await pg.wait_for_timeout(400); await pg.screenshot(path=f"{os.environ['SHOT_DIR']}/loc_{tag}_runs.png")
        await E("()=>{const d=document.querySelector('#locq');d&&d.scrollIntoView({block:'center'})}"); await pg.wait_for_timeout(300); await pg.screenshot(path=f"{os.environ['SHOT_DIR']}/loc_{tag}_form.png")
    await E("()=>document.querySelector('#locruns [data-act=loc-lines]').click()"); await pg.wait_for_timeout(300)
    r["lines"] = await E("()=>[S.subs.tab,S.subs.active,S.subs.segs.filter(s=>(s.text.es||'').startsWith('Hola')).length]"); ok(r["lines"] == ["lines", "es", 4], f"{tag}: translated lines in the editor of lines {r['lines']}")
    await E("()=>{S.subs.tab='dub';renderView()}"); await pg.wait_for_timeout(300)
    await E("()=>document.querySelector('#locruns [data-act=loc-editor]').click()")
    ok(await wait_for("()=>S.view==='edit'", 10), f"{tag}: opened in the editor")
    r["editor"] = await E("()=>{const j=locJob(LOCD.items.find(y=>y.id===S.loc.sel),'es');return [!!j,S.ed.clips.some(c=>c.src&&c.src.job===(j&&j.id)),S.ed.texts.filter(t=>t.text.startsWith('Hola')).length]}")
    ok(r["editor"][0] and r["editor"][1] and r["editor"][2] == 4, f"{tag}: dubbed clip + subtitles in the editor {r['editor']}")
    await E("()=>{go('subs');S.subs.tab='dub';renderView()}"); await pg.wait_for_timeout(300)
    await E("()=>document.querySelector('#locruns [data-act=loc-pub]').click()")
    ok(await wait_for("()=>S.view==='calendar'", 10), f"{tag}: publish opens the planner")
    r["post"] = await E("()=>{const p=S.pub.posts.find(x=>x.id===S.pub.sel);const j=p&&S.jobs.find(x=>x.id===p.media);return [!!p,j&&j.kind]}"); ok(r["post"] == [True, "dub"], f"{tag}: post with the dubbed video {r['post']}")
    await E("()=>{go('subs');S.subs.tab='dub';renderView()}"); await pg.wait_for_timeout(300)
    await E("()=>document.querySelector('#locruns [data-act=loc-vss]').click()")
    ok(await wait_for("()=>S.view==='vss'&&VSSD.items.length>0", 15), f"{tag}: analyse the dub in Video intelligence")
    ok(await wait_for("()=>{const r=vssSel();return r&&r.status==='complete'}", 60), f"{tag}: analysis complete")
    r["vss"] = await E("()=>{const r=vssSel();return [r.audio,!!document.querySelector('[data-act=vss-dub]'),document.querySelectorAll('.vsay').length]}")
    ok(r["vss"][0] is True and r["vss"][1], f"{tag}: VSS hears speech + Translate & dub button {r['vss']}")
    await E("()=>document.querySelector('[data-act=vss-dub]').click()")
    ok(await wait_for("()=>S.view==='subs'&&S.subs.tab==='dub'&&S.subs.src&&S.subs.src.k==='job'", 10), f"{tag}: Translate & dub opens dubbing with the video")
    # admin: the two new connectors
    await E("()=>{S.view='admin';S.admin=S.admin||{};renderAll()}"); await pg.wait_for_timeout(400)
    r["admin"] = await E("()=>AI_PROVIDERS.filter(p=>p[0]==='camb'||p[0]==='nvloc').map(p=>p[0])"); ok(r["admin"] == ["camb", "nvloc"], f"{tag}: admin connectors {r['admin']}")
    ok(not errs, f"{tag}: page errors {errs}")
    await b.close(); return r

async def main():
    async with async_playwright() as p:
        for w in (390, 1280): out[w] = await ui(p, w)

if __name__ == "__main__":
    mk = subprocess.Popen(["node", D + "/mock.js", str(LPORT), str(GPORT), D, ROOT + "/proto/content-localization"], cwd=D, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "CAMB_", "NV_LOCALIZE"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="l" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", LOC_POLL_MS="100",
        LLM_API_KEY="mock", LLM_BASE_URL=f"http://localhost:{LPORT}", LLM_MODEL="mock-text", ELEVENLABS_API_KEY="el-test", ELEVENLABS_BASE_URL=f"http://localhost:{LPORT}/el",
        CAMB_API_KEY="camb-test", CAMB_BASE_URL=f"http://localhost:{LPORT}/camb", NV_LOCALIZE_URL=f"127.0.0.1:{GPORT}", NV_LOCALIZE_TOKEN="nv-tok", NV_LOCALIZE_MODE="elevenlabs"), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=1); break
            except Exception: time.sleep(.25)
        api_checks()
        asyncio.run(main())
    except Exception as e:
        import traceback; fails.append("crash: " + traceback.format_exc()[-800:])
    finally:
        srv.terminate(); mk.terminate()
        try: err = srv.stderr.read().decode()[-1500:]
        except Exception: err = ""
    print(json.dumps({"fails": fails, "out": out, "serverLog": err if fails else ""}, ensure_ascii=False, default=str, indent=1))
    sys.exit(1 if fails else 0)
