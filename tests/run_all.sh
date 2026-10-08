#!/usr/bin/env bash
# Full UI check. Usage: bash tests/run_all.sh   (NOOI_URL=https://nooi.ai to test the live site)
set -e
cd "$(dirname "$0")/.."
echo "▶ syntax"; for f in server.js lib/*.js providers/*.js social/*.js; do node --check "$f"; done
python3 - <<'PY'
import re,subprocess,sys
s=open("public/index.html",encoding="utf-8").read()
open("/tmp/nooi_ui.js","w",encoding="utf-8").write(re.findall(r"<script>(.*?)</script>",s,re.S)[0])
rc=subprocess.call(["node","--check","/tmp/nooi_ui.js"])
import collections
js=open("/tmp/nooi_ui.js",encoding="utf-8").read()
names=re.findall(r"(?:^|[;{}\n])\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(",js)
d={k:v for k,v in collections.Counter(names).items() if v>1}
print("duplicate function names:", d or "none")
sys.exit(rc or (1 if d else 0))
PY
echo "▶ every control on every page";  python3 tests/fuzz.py | tail -2
echo "▶ layout on phone / iPad / desktop"; python3 tests/allviews.py | tail -3
echo "▶ tiles fit their content (must be 0)"; python3 tests/tiles.py | head -3
echo "▶ overlapping text on phone (light/dark), iPad, desktop (must be 0)"; python3 tests/overlap.py | tail -1
echo "▶ A–Z audit (menu/page names, tap targets, unlabeled buttons)"; python3 tests/audit_az.py | python3 -c "import sys,json;d=json.load(sys.stdin);print('name mismatches:',[x for x in d['titleMismatch'] if not x.startswith('home')] or 'none','| unlabeled:',d['noLabel'] or 'none')"
echo "▶ animated icons & live bots"; python3 tests/ui_polish.py | python3 -c "import sys,json;t=sys.stdin.read();d=json.loads(t[:t.rfind('}')+1]);print('icons with motion',d['iconsWithMotion'][:4],'| live bots',d['liveBots'],'| model chip',d['liveModelChip'])"
echo "▶ overlapping text on every page (must be 0)"; python3 tests/overlap.py | head -2
echo "▶ prompt studio (tasks, models, structured brief)"; python3 tests/prompt_studio.py | python3 -c "import sys,json;t=sys.stdin.read();d=json.loads(t[:t.rfind('}')+1]);print('tasks',d['tasks'],'| video models',len(d['videoModels']),'| parsed job',d['videoJob']['model'],d['videoJob']['dur'],'s',d['videoJob']['fps'],'Hz',d['videoJob']['aspect'],'| images',d['imageJobs'],'| template heights',d['tplHeights'])"
echo "▶ agents, flagship models, plans, CRM & ERP"; python3 tests/agents_models_crm.py | python3 -c "import sys,json;t=sys.stdin.read();d=json.loads(t[:t.rfind('}')+1]);print('agents',len(d['agents']),'| new models',d['newBadges'],'| free→Kling 4.0 blocked',d['freeKling40'],'| CRM cols',d['crm']['columns'],'| ERP kpis',d['erp']['kpis'])"
echo "▶ flagship models, plan colours, CRM & ERP"; python3 tests/models_plans_crm.py | python3 -c "import sys,json;t=sys.stdin.read();d=json.loads(t[:t.rfind('}')+1]);print('agents',len(d['agents']),'| new models',d['newBadges'],'| crm cols',d['crm']['columns'],'| erp kpis',d['erp']['kpis'])"
echo "▶ draw & create, 3D worlds, GLB"; python3 tests/draw_world.py | python3 -c "import sys,json;t=sys.stdin.read();d=json.loads(t[:t.rfind('}')+1]);print('admin link',d['adminLoginScreen'],'| sketch jobs',len(d['sketchJobs']),'| edit jobs',len(d['editJobs']),'| world moves',d['movedViewChanged'])"
echo "▶ hidden or cut-off text · 375/768/1024/1280/1440 px (must be 0)"; python3 tests/hidden_text.py | head -3
echo "▶ ElevenLabs, image models, status, credits sheet, long videos"; python3 tests/voice_images_status.py | python3 -c "import sys,json;t=sys.stdin.read();d=json.loads(t[:t.rfind('}')+1]);print('EL basic blocked',d['basicElevenLabs'],'| image models',len(d['imageRail']),'| 30s parts',d['longVideo']['parts'],'| credits sheet',bool(d['creditsSheet']),'| health rows',len(d['health']))"
echo "▶ provider protocol with a mocked network (auth · rate limit · outage · retries · health · streaming · durations)"; node tests/providers_mock.mjs | tail -1
echo "▶ Kie AI adapter with a mocked network (market · Veo · Suno · errors · routing · health)"; node tests/kie_mock.mjs | tail -1
echo "▶ home create box: model logo row, results under the box, approve → editor / Images"; python3 tests/home_results.py | python3 -c "import sys,json;d=json.load(sys.stdin);print('fails',d['fails']);sys.exit(1 if d['fails'] else 0)"
echo "▶ top-ups, gift cards (credits & plans), redeem, invoices with VAT (test payment provider)"; node tests/gifts_e2e.mjs | tail -1
echo "▶ Kie AI end to end (mock Kie server + real nooi server: image, edit, Midjourney, video, image→video, music)"; node tests/kie_e2e.mjs | tail -1
echo "▶ video editor with real media (touch + mouse: seek, scrub, select, play, split, duplicate, move, delete, undo, trim, speed, text, music, MP4 export)"; python3 tests/editor_real.py | python3 -c "import sys,json;d=json.load(sys.stdin);print('fails',d['fails']);sys.exit(1 if d['fails'] else 0)"
echo "▶ editor pro tools (smooth playback, drag/resize/delete on the preview, timeline edges, effects, infographics, AI translate, AI voice types, export)"; python3 tests/editor_pro.py | python3 -c "import sys,json;d=json.load(sys.stdin);print('fails',d['fails']);sys.exit(1 if d['fails'] else 0)"
echo "▶ v72: pinned editor preview, no page jumps, sound lanes, AI effects, logo size, sketch → real picture, character from a photo, AI full 3D (object + character), 3D world from a photo, templates"; python3 tests/v72_features.py | python3 -c "import sys,json;d=json.load(sys.stdin);print('fails',d['fails']);sys.exit(1 if d['fails'] else 0)"
echo "▶ ChatGPT / Claude MCP connector handshake (initialize · tools/list · tools/call · token checks)"; node tests/mcp_chatgpt.mjs | tail -1
echo "▶ shipped translations (i18n/*.txt → public/i18n/*.json up to date, no lost numbers)"; node i18n/build.mjs --check | grep -v "^✓" || echo "all languages OK"
echo "▶ shared interface translations with a mocked text AI (whitelist · cache · one call · rate limit)"; node tests/uit_mock.mjs | tail -1
echo "▶ email sign-in codes (6 digits · one-time · 5 tries · 10 min)"; node tests/otp_mock.mjs | tail -1
echo "▶ security: no secrets in the browser bundle"; python3 tests/security_scan.py
echo "▶ directive breakpoints 767/768/1079/1080/1279/1280 (phone <768 · tablet 768–1079 · desktop ≥1280)"; python3 tests/breakpoints.py | python3 -c "import sys,json;d=json.load(sys.stdin);bad={w:list(v['problems']) for w,v in d.items() if v['problems']};print('layouts',{w:('phone' if v['layout']['bottomNav'] else 'rail' if v['layout']['sidebar']<120 else 'full') for w,v in d.items()},'| problems',bad or 'none')"
echo "▶ flat bots: unique idle / working / done motion (must be 8/8 each)"; python3 tests/flat_bots.py | python3 -c "import sys,json;t=sys.stdin.read();d=json.loads(t[:t.rfind('}')+1]);print('idle',d['uniqueIdle'],'| working',d['uniqueWorking'],'| done',d['uniqueDone'])"
echo "▶ logo: the dot rides the line and lands on the i (load · hover · page change · tap)"; python3 tests/brand_dot.py | grep -cE "on tip \(gap 0\)|at the i" | xargs -I{} echo "dot checkpoints passed: {}"
echo "▶ equal fields · aligned switches · equal panels · nothing off-screen — every page & admin tab, 360/390/820/1440 px (all must be 0)"; python3 tests/equal_layout.py | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['totals'])"
echo "▶ uniform fields, toggles, cards & options · every page + admin tab · phone/tablet/desktop (all must be 0)"; python3 tests/uniform.py | python3 -c "import sys,json;print(json.load(sys.stdin)['totals'])"
echo "▶ real web fonts × every script (Thai, Tamil, CJK, Ethiopic, Arabic-script…): overlap & clipped text"; if curl -fsS -m 5 -o /dev/null https://fonts.googleapis.com/css2?family=Geist; then python3 tests/script_fonts.py | python3 -c "import sys,json;print(json.load(sys.stdin)['totals'])"; else echo "skipped (Google Fonts unreachable)"; fi
echo "▶ RTL & languages";                python3 tests/langviews.py | tail -3
echo "▶ untranslated text (review list)"; python3 tests/i18n.py | head -1
echo "▶ audio lab (noise removal dB, pitch ratios)"; python3 tests/audio.py | head -40 | grep -E "noiseAfter|voiceToNoise_after|pitchHz" | head -8
echo "▶ film crew (offline chain + AI with injected errors, send-back, deliverables)"; python3 tests/crew.py | python3 -c "import sys,json;t=sys.stdin.read();d=json.loads(t[:t.rfind('}')+1]);print('offline',d['offline']['status'],'| ai',d['ai']['status'],d['ai']['score'],'loops',d['ai']['loops'],'| cancel',d['cancel'])"
echo "▶ motion tracking accuracy";       python3 tests/trk.py | grep meanErr
echo "▶ pro tools: every editor tab, 3D studio, motion capture, Kie AI card — every control (errors must be [])"; python3 tests/pro_tools.py | python3 -c "import sys,json;d=json.load(sys.stdin);print('clicks',d['clicks'],'|',d['checks'],'| errors',d['errors']);sys.exit(1 if d['errors'] else 0)"
