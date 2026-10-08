# nooi.ai — project guide for Claude Code

AI video & design platform (Arabic-first, bilingual EN/AR, 14 UI languages). Owner-facing notes in Arabic are welcome; keep code/comments in English.
Owner wants every English text followed by an Arabic translation in replies.

## Layout
```
public/index.html      the whole studio UI — one self-contained file (vanilla JS, no build step)
server.js              Express API (ESM, Node ≥18). Serves public/ and /media, all /v1/* routes, /mcp
lib/                   store (JSON db in data/db.json), auth (Firebase + API tokens), jobs (queue/poll/refund),
                       billing (credits ledger, Moyasar/Tap/Stripe/PayPal/Airwallex, coupons), settings (encrypted keys),
                       admin (RBAC, clients, emails, tickets, audit), email (Resend/SendGrid), mcp, scheduler, site, media, tokens, moderation
providers/             index.js (generic REST adapters: WAN, TTS, lipsync, music…), extra.js (Seedance, Kling, Qwen/DashScope),
                       anthropic.js (text AI; Claude or Anthropic-compatible Qwen; model per tier), generic.js
social/                OAuth + publishing (Meta, TikTok, YouTube, X, LinkedIn, Snapchat)
integrations/          Blender add-on, Unity editor window, MCP client configs
deploy/                install.sh (Hostinger/Ubuntu one-command), update.sh (auto-rollback), backup.sh, restore.sh
docs/                  PAYMENTS_ROADMAP.md, policies/*.en.md|ar.md
tests/                 Playwright checks (click every control, layout overflow on 4 devices, tracking accuracy, playhead smoothness)
```

## Frontend architecture (public/index.html)
- Global state `S` (persisted: localStorage `dotai-studio-v2` + server sync). `persist()` saves; `renderAll()` / `renderView()` re-render.
- Views: `VIEWS[name] = () => html`. Navigation: `NAVS` groups → `go(view)`.
- Events are delegated on `document`: `data-act="…"` (actions), `data-set="path" data-val` (set state), `data-toggle`, `data-bind` (inputs), `data-go`.
- `L(en, ar)` for every UI string (other languages are AI-translated & cached). Always pass both.
- `tilify(html)` turns chip rows into icon tiles. Icons: `ICONS` / `OI` (inline SVG paths). No emoji icons in UI chrome.
- The file grew in layers: later sections (`/* ===== vN: … ===== */`) wrap earlier functions (`fn=(o=>function(){…o()…})(fn)`) and patch view HTML with `.replace(...)`.
  When refactoring, preserve behaviour; a good first big task is splitting it into ES modules with a small build (Vite) — keep a single-file build output.
- Feature flags: admin `features` (per view), `modelOn()`, and `GPU_FEATURES=false` (SAM 3D / 3D body / render streaming are OFF on purpose — no GPU yet).
- API mode: `API.mode === "server"` when served by this server; otherwise it runs a local demo engine (procedural renders, demo data).

## Server essentials
- Start: `npm install && npm start` (PORT 8080). Health: `GET /v1/health`.
- Every generation goes through `lib/jobs.js createJob` → moderation → feature/model switches → price (`lib/billing.js priceOf`) → charge → provider submit → poll → refund on failure.
- Provider & payment keys: `.env` or Admin dashboard (encrypted with `SECRET_KEY`, AES-256-GCM). Never log or return secrets.
- Owner = `ADMIN_EMAILS`. Roles/permissions in `lib/admin.js`.

## Feature map (where things live in the UI)
| Group | Tools (in order) |
|---|---|
| Home | universal prompt (task + AI model, first/end frame + seconds, voice), projects, ⌘K search |
| Create | Video · UGC & product ads (presenter/product/image/motion, product photos, brand logo, fonts) · Images · Characters (builder, cloned voice) · Live Sketch (+ floor plans → 3D, three.js) · Coloring book |
| Story | Chapter Story · Storyboard (cast & assets scan) |
| Edit | Video editor (clips, text + fonts, audio + voice recording, motion tracking, logo watermark, undo, shortcuts) · Visual effects · Voice & audio (audio lab: noise removal + voice changer, my cloned voices) · Subtitles & dubbing · Enhance |
| Publish | Website & content plan · Hook lab · Schedule & publish |
| Library | My library · Templates |
| Settings | Account (plans, brand kit, usage, smart routing) · Connections · Integrations/MCP · Legal & payments · Help & support |
| Admin | overview · clients (country filters, bulk email/discounts/invoices, CSV) · support · emails · features · AI providers & prices · payments · admins & permissions · audit |

Languages: UI 26 (RTL: ar, fa, ckb, ur) · subtitles/dubbing/voice incl. de, nl (+Flemish), fr-BE, pt, it, th, sw, sr (Cyrl/Latn), hr/bs/me, ms, ta, fa (+Dari), ku (Kurmanji), ckb (Sorani).
Audio lab (in-browser DSP, no upload): spectral noise gating + hum (50/60 Hz) & rumble filters; voice changer = WSOLA pitch shift (duration kept) + filters, 10 styles; AI speech-to-speech (`voiceconvert` job → TTS provider) to library or cloned voices. Measured: noise −17 dB, pitch ratios within 2%.
Voice: dictation (Web Speech API) on prompt fields; voice cloning with mandatory consent (`voiceclone` job → TTS provider).
Theme: dark / light (animated SVG sun↔moon). GPU features OFF (`GPU_FEATURES=false`).

## Plans & entitlements (one source: PLANS/LIMITS in index.html ⇄ lib/plans.js)
| | Free | Basic 49 SAR ($13) | Pro 99 SAR ($27) | Studio 199 SAR ($53) |
|---|---|---|---|---|
| Credits / month | 100 | 1,500 | 4,000 | 10,000 |
| Parallel · max length · fps | 1 · 5s · 30 | 2 · 10s · 60 | 4 · 15s · 120 | 8 · 15s · 120 |
| Video models | standard | + Hunyuan | all (Kling, Seedance, WAN 3.0…) | all |
| Characters · chapters · voice clones | 2 · 3 · 0 | 10 · 8 · 1 | ∞ · 20 · 3 | ∞ · 20 · 10 |
| Watermark · API/MCP | yes · no | no · no | no · no | no · yes |
Yearly = −20% (credits refilled every 30 days by `refillPlans`). Server enforces in `createJob` → `checkEntitlement` (402 = upgrade, 429 = wait for a running job). Change prices in both files together.
120 fps: generation option (`meta.fps`, +2/+4 cr), "120 fps" action on results, editor export fps (60 recorded directly, 120 via `finish:interp` job).

## UX conventions (v27)
- `toast(msg, {type:"ok"|"warn"|"info", action, onAction, ms})` — deletions show an **Undo** action (snapshot restore).
- Drag & drop anywhere routes files by page/type (`routeFiles`). `?` opens the shortcuts sheet, Esc closes sheets.
- Credits ledger: `S.ledger` (demo) / `GET /v1/billing` ledger (server) → **Credits & transactions** page with CSV export.
- Motion: `.vin` page entrance, `.tabin` tab fade, count-up stats; everything is disabled under `prefers-reduced-motion`.
- Selects: native `<select>` is auto-replaced by a styled sheet (`enhanceSelects`, add `data-native` to opt out). Keep using real `<select>` + change events.
- Logo: `.brand` gets the animated wordmark (`LOGO`: eyes blink/follow pointer, green dot pulses). Icons draw in (`pathLength=1`) when active.
- Tiles: glyph box grows with content; `tests/tiles.py` must report 0 broken tiles.
- Bots (v31): glossy SVG mascots (`BOT_LOOK`, `SHAPES`, `botSVG(id,state)`), states idle · waiting (eyes closed) · working (visor with bars/wave + orbit halo) · done (happy + sparkles) · failed (sweat drop).
- Prompt box: structured example per task (`EXAMPLE`, `parsePrompt` feeds the bots), task chips (`UNI_TASKS`), video/image model cards only (`MODEL_META` monograms; official logos only via Admin upload with the provider's permission), seconds per model + fps.
- Layout rules: inline two-column grids collapse on ≤900px; fill-screen layouts grow on ≤1024px; text fields are `dir=auto` with the mic pinned to a physical side. `tests/overlap.py` must report 0.
- Animated icons: every SVG is matched to its name (`ICON_NAME`, canonical markup) and gets `data-mo` from `MOTION` (spin/up/down/pop/wiggle/flip/slide/look/bob). They play on hover/tap and morph to a soft duotone fill when active. Add new icon names to `MOTION`.
- Live bots: `botStrip(ids)` under prompts; `busyBots()` maps running jobs → bots (`JOB_BOTS`), updated every 0.7 s; model chips spin while that model renders.
- Icons: inline SVG, `ic(name)` stroke 1.7; add new names to `ICONS` (the icon audit in tests flags missing ones).

## Film crew (8 bots) — view `crew`
Order & contracts: Rawi writer → Wajh character designer → Sima director → Ayn cinematographer → Sada sound → Wasl editor → Mizan producer → Daqiq proofreader/QA.
Each stage: `crewPrompt` (role + brief + everything handed over) → `aiJSON` (sample in preview / `/v1/llm/json` with tier on server, 150 s timeout, abortable) → `normalize` (types, clamps, enum snapping incl. labels) → `vSchema` (SCHEMA[id]) + `crossCheck` (ids, coverage, speakers, plan limits, budget) → up to 3 attempts with a repair prompt listing the failed checks → `fallback` generator if still failing (stage marked "fallback"). After Mizan: `hardAudit` (missing outputs, moderation, language, cross checks, budget) → Daqiq audits with those findings → can `send_back_to` one stage (1 loop) → final re-audit → approved / review. Everything is logged (`run.log`) and persisted; a reload marks a running crew as stopped.
Deliverables: storyboard, Chapter Story, render all shots (plan-aware models), voices + music jobs, Markdown + JSON package. Prompt mascot follows the task (`TASK_BOT`). Test: `tests/crew.py` injects model mistakes and must end "approved".

## Prompt studio (home) — v31
Tasks rail (content video, product ad, image & design, create voice, music, story, storyboard, character, whole film, coloring, hooks) → model rail ONLY for video/image (VRAIL/IRAIL incl. MiniMax Hailuo; monogram badges — official logos are uploaded by the admin in Admin → Models, stored in settings.modelLogos and served in /v1/config) → seconds & Hz (video) or count & aspect (image) → structured brief placeholder ("Idea:/Scene:/Voice:/Sound:/Style:" in any language) parsed by `parseBrief` so bots get clean fields.
Bots v2: `botSVG` draws glassy blobs; states idle (eyes closed) → working cycles plan (visor bars) → tool (visor ∞ + ribbons) → action (eyes) → done (happy + effects) / failed (worried). Shared defs in `#botdefs`.
Layout guard: `tests/overlap.py` must report 0 pages with overlapping text (clip-aware, ignores closed <details>).

## v32–v33 additions
- Agents (names localised since v47): Quill (beret), Nova (star), Max (mustache), Lumi (monocle), Echo (headphones), Remy (beanie), Duke (top hat + bow tie), Iris (glasses + bun). Accessories live in `ACC`; face accessories hide while the visor is on.
- Flagship video models (FLAG): Kling 4.0 / 3.0, Seedance 2.5 / 2.0, MiniMax H3, WAN 3.0. Features shown are each family's known strengths — CONFIRM specs and set each API model id in Admin → Models (server refuses jobs with 503 until set). Plans: Basic = WAN 3.0 + Seedance 2.0 · Pro = + Seedance 2.5, Kling 3.0, MiniMax H3 · Studio = all incl. Kling 4.0. Plan colours: Ocean / Neon / Gold.
- Admin: CRM (pipeline, deals, follow-ups) and ERP (P&L, VAT 15 %, expenses, vendors, invoice register, credits liability) → `/v1/admin/data/crm|erp`.
- Footer "Admin login" (signed-out users sign in, then land on the dashboard).
- Draw & create (sketch view modes): draw a scene → N AI options (image/video, style, follow %), or upload + describe → N edited options (`meta.mode` sketch2img / instruct-edit, input slot `dmIn`).
- 3D World (`world` view): instant procedural three.js world (7 biomes, time, size), orbit/flythrough, snapshot, record 8 s to the editor, GLB export, Blender steps; cloud engines via WORLD provider (`world` job, 40 cr). Rendering needs three.js from the CDN — verify on a real device.

## v32–v33 additions
- Agents (names localised since v47): Quill (writer, beret) · Nova (character designer, star body) · Max (director, mustache) · Lumi (cinematographer, monocle) · Echo (sound, headphones) · Remy (editor, beanie) · Duke (producer, top hat & bow tie) · Iris (QA, glasses & bun).
- Flagship video models: Kling 4.0/3.0, Seedance 2.5/2.0, MiniMax H3, WAN 3.0 (`FLAG`). Features shown are family strengths; the admin must set each **API model id** and mark specs verified in Admin → Models (`settings.modelCat`). Server routes `kling40…` via `flagship()` and refuses (503) without an id. Plans: Basic → WAN 3.0 + Seedance 2.0; Pro → + Seedance 2.5, Kling 3.0, MiniMax H3; Studio → + Kling 4.0. Plan themes: Ocean / Neon / Gold.
- Admin CRM (pipeline, deals, follow-ups) & ERP (P&L, VAT 15%, AI cost estimate, expenses, invoices register, credit liability): `/v1/admin/data/crm|erp`.
- Footer "Admin login" (app & landing). Draw & create (`draw`): sketch → AI scenes (sketch sent as iRef) or upload → instruction edit (eRef, kind "edit"). 3D worlds (`world`): procedural voxel-space renderer in the browser, `.glb` export for Blender, optional AI world provider (kind "world", 40 cr, WORLD_API_URL).

## v34
- Model logos: `LOGO_SRC` holds small WebP crops of logo files the owner supplied (Kling, Seedance, MiniMax, Wan). They come from screenshots — replace them with each provider's official brand-kit files (Admin → Models → logo upload, stored in settings.modelLogos) and follow each provider's brand guidelines before launch. `logoFor(id)` prefers the admin upload.
- Text visibility: `tests/hidden_text.py` must report 0 (no ellipsis/line-clamp/clipped text on any page at 390/820/1440 px, en & ar). The storyboard canvas is excluded (pannable by design).

## v35 (integration directive)
- Durations: Basic 10 s · Pro 20 s · Studio 30 s (free 5 s). Longer than a model's max → `meta.parts`; the server makes N connected parts (`chainAfter` → last frame of the previous part) and completes the parent with `segments`.
- ElevenLabs (`providers/elevenlabs.js`): TTS, `/v1/tts/stream` low-latency preview, voice cloning. Pro: Flash/Turbo/Multilingual; Studio: + Eleven v3 & ElevenLabs cloning. Model ids/default voice are admin-overridable — verify with ElevenLabs docs.
- Image models: Nano Banana / Pro (Google Gemini image API, `GOOGLE_API_KEY`), Image 2.0/2.5 (provider set by admin — **ask the owner which provider**), Qwen Image 2.0 (DashScope, model id in admin), Midjourney (disabled: no official public API known; only an authorised provider). Specs & tech panel shows qualitative specs; the admin confirms.
- Errors: `lib/errors.js` classifies auth / rate / provider / network / quota / input; `withRetry` retries rate/provider/network 3× with backoff; failed jobs carry `errorType` + a user message; credits are refunded.
- Health: `lib/health.js` probes each provider (authenticated cheap call), maintenance flag, `GET /v1/status` feeds live Online/Degraded/Maintenance/Not connected tags; auto re-test every 15 min.
- Export: WebM in the browser; MP4 via `POST /v1/media/transcode` (ffmpeg on the server). Voice: MP3/WAV.
- Tests now run at 375/768/1024/1280/1440 px; `tests/security_scan.py` fails on any secret in the browser bundle.

## Device breakpoints (directive)
Phone < 768 px (bottom nav, single column, bottom-sheet model picker, sticky preview) · Tablet 768–1079 px (icon rail) · Desktop ≥ 1280 px (full sidebar; 1080–1279 keeps the rail up to 1180). CSS uses max-width:767px / min-width:768px. `tests/breakpoints.py` checks the exact boundaries.
Note: the ElevenLabs / image models / 10-20-30 s / status / errors directive is implemented in v35 (frontend) + providers/elevenlabs.js, providers/images2.js, lib/health.js, lib/errors.js — extend those, don't re-add.

## v35 directive status (ElevenLabs · image models · 10/20/30 s · status · errors · devices)
Implemented and covered by tests: `voice_images_status.py`, `security_scan.py`, `breakpoints.py`, `providers_mock.mjs` (18 checks, mocked network).
Still to do with real keys (cannot be done offline): run Admin → AI providers → "Test all", generate one ElevenLabs line (MP3 + WAV) and one image per new model, confirm each model id/spec and mark it verified.
Midjourney has no official public API — keep it disabled; do not wire unofficial Discord proxies (terms-of-service risk). "Image 2.0 / 2.5" and "Nano Banana" providers/model ids are set by the admin.
In the demo preview provider status reads "Demo" (nothing is connected); the live server shows real Online / Degraded / Maintenance / Not connected.

## v36 flat bots (current look)
`botSVG` (v36 block) draws flat solid shapes with white eyes: Quill orange cloud · Nova brown clover · Max blue triangle · Lumi black lens circle · Echo green capsule · Remy grey drop · Duke yellow hexagon · Iris purple rounded square.
Each bot has its own idle, working and done motion (CSS `fb*` keyframes in the v36 CSS); `tests/flat_bots.py` must report 8/8 unique for each state. Older bot drawings (v31a glossy, v32a accessories) are no longer used by `botSVG`.

## v37 GPT Image 2.0 · Nano Banana (Pro) · ElevenLabs
- Icons: crops of files the owner supplied (OpenAI mark, banana, ElevenLabs "II") in `LOGO_SRC` — replace with official brand-kit files and follow each brand's guidelines.
- GPT Image 2.0 = `img20` → `gptImage()` (providers/images2.js, OpenAI Images API). It REQUIRES `settings.modelCat.img20.apiModel`; without it the job stops with a setup message (nothing is sent under that name). Plans: Pro & Studio. "Image 2.5" is hidden from the rail (no provider named).
- Nano Banana (`nano`, all plans) / Nano Banana Pro (`nanopro`, Pro & Studio) → Gemini API (`nanoBanana`). ElevenLabs: Pro = Flash v2.5 · Turbo v2.5 · Multilingual v2; Studio = + Eleven v3 + professional cloning.
- Feature texts are from public descriptions known to mid-2026 (no web search was available when written) — verify against current docs. The "v37b" block adds a "Specs: verified / to verify" row to each specs panel (driven by `settings.modelCat[id].verified`). This block is the single source; a later duplicate was removed.

## v38 Brand
- Logo mark rebuilt as a centre-line vector from the owner's logo file (97% pixel match); `nooiMark()` + `.nbrand` in the header (mark only — the owner asked to remove the "nooi.ai" text wordmark; the name stays as aria-label); one controller `playMark()` runs on load, every page change, hover and tap: the line draws bottom-left → top-right while the dot rides its tip, then the dot hops onto the "i" and keeps beating (CSS). `public/brand/nooi-logo-animated.svg` does the same with SMIL (no script). One JS controller `playMark(svg)` (Web Animations API) restarts line + dot together every time: first appearance, every new header after navigation, mouse hover and touch tap. `tests/logo_motion.py` checks the dot is hidden while the line draws and pops at the end in all five cases. Files in `public/brand/` (SVG, animated SVG, PNG 4096→180, favicon.ico).
- Colours from the logo: `--brand-a #6EC046`, `--lime/--brand-m #9CD245`, `--brand-b #CFE13E` (the dot, reference colour), `--brand-grad`. An earlier duplicate mark implementation was removed.

## v39 Equal layout rules (all devices)
- Every text-like input (incl. password, url, search, date, time) shares one style and full width; a form's Save button sits on its own line.
- `div.trow` toggle rows: name `1fr`, switch pinned to the last column so switches line up; `label.trow` (CRM follow-ups) keeps checkbox · text · date.
- Tab bars (`.tabs`) wrap instead of hiding tabs off-screen; side-by-side panels in `.admgrid/.two/.pubgrid/.edgrid` share one height.
- `tests/equal_layout.py` walks every view **and every admin tab** at 360/390/820/1440 px and must report 0 for fields, toggles, cards and overflow.

## v39–v41 uniform layout (fields · toggles · cards · options)
- `.trow` keeps its original flex layout everywhere; the CRM follow-up list uses `.tlist .trow` (an earlier global `.trow` grid broke payment and provider rows).
- `.grid2` and `.fields` use `repeat(auto-fit,minmax(min(200px,100%),1fr))`, so side-by-side fields stack on their own when space runs out; inline `grid-template-columns` on `.grid2` is overridden for the same reason.
- `balanceGroups()` (v41) equalises option tiles: same-size options, and any short last row is centred. Segmented controls get equal-width buttons (`.seg.eq`) or wrap (`.seg.eqwrap`).
- Provider/payment cards keep their Save button at the bottom so buttons line up across a row.
- `tests/uniform.py` must report all zeros (field widths, field heights, toggle alignment, card heights, option balance, cramped field columns, overflow) on every page and admin tab at 390 / 820 / 1440 px.

## v42 fonts for every UI language
- `loadUIFont()` downloads the language's font, but CSS only used it for ar/ja/zh/ko/hi/am: Thai and Tamil (and Vazirmatn for fa/ckb) were downloaded and never applied, so text fell back to the device font (different metrics → overlaps). The v42 block builds `html[lang=…] body, .serif` rules from `UI_FONTS`, with line-height 1.7 for tall scripts (`NOOI_TALL_SCRIPTS`). Add a language's font to `UI_FONTS` only — the rule follows.
- Plan prices (`.plan2 .pp`) and template tags (`.tmeta span`) wrap instead of being cut.
- `tests/script_fonts.py` loads the real Google Fonts and fills every page with real-script text at a typical translation length (`EXPANSION`), then reports overlapping/clipped text and system-font fallback. The other layout tests block the network, so they never see the real fonts. Remaining findings at stress length are intended truncation (2-line card titles, select values) or the pannable storyboard/3D views.

## v43 Kie AI (one key, many platforms)
- `providers/kie.js`: market models `POST /api/v1/jobs/createTask {model,input}` → poll `/api/v1/jobs/recordInfo` (state, resultJson.resultUrls); Veo `veo3|veo3_fast|veo3_lite` → `/api/v1/veo/generate` + `/veo/record-info` (successFlag); `suno:V5` → market `ai-music-api/generate` (result = data[].audio_url). Kie answers HTTP 200 with its own `code` (401 key, 402 credits, 422 input, 429/433 rate) — mapped to the usual error types so jobs retry/refund correctly.
- Input fields differ per family (`kieInput`): Kling duration "5"/"10" + image_urls · Seedance/MiniMax H3 first_frame_url · Hailuo/Wan 2.7 image_url · Nano Banana image_input · others image_urls; image-to-video ids get no aspect_ratio. Admin can add/override fields per model id with the "Extra inputs" JSON.
- Routing (`adapterFor`): a studio model with `modelCat[id].kieModel` runs on Kie (Admin → Models → "Run on Kie AI"); the generic video/image/music provider falls back to the Kie default model when not connected. Health probe: `/api/v1/chat/credit` (shows credits left).
- Model ids come from kie.ai's docs (not reachable from the build sandbox) via a maintained open-source client — confirm on kie.ai and run one job per model before launch. Test: `node tests/kie_mock.mjs`.

## v44 Real model logos
- `LOGO_SRC` now holds vector marks from Lobe Icons (MIT, `@lobehub/icons-static-svg`) instead of screenshot crops; `MODEL_LOGO` maps every model in FLAG/VRAIL/IRAIL plus ElevenLabs voices (Seedance → ByteDance mark, WAN → Alibaba, nooi models → nooi logo, Nano Banana → the Nano Banana icon). Single-colour marks are filled #111 for the white logo tile. Admin uploads still override (`logoFor`). The marks are the providers' trademarks — follow each brand's guidelines.

## v45 Prompt box layout
- CSS-only block `#v45prompt`, scoped to `.panel.uni`: task chips wrap on desktop (≥1080 px) and swipe with a fade below; prompt surface with a brand focus ring; equal 212 px model cards that snap (170 px on phones) with a fade where the rail continues (mirrored in RTL); Seconds / Frame rate / Aspect in one tray with full-width segmented controls; "First & end frame" as a pill; crew row spread evenly; larger Create button. Section labels avoid letter-spacing/uppercase so Arabic-script labels stay joined.

## v46 Crew row
- Duke no longer flips: idle `fbDukeBob`, working `fbDukeNod`, done `fbDukeHop` (replaced fbCoinIdle/fbFlip/fbCheer's 180° spin). All crew bots render at full opacity.
- `botStrip` is wrapped: each `.sbot` gets `--bc` (first colour of `BOT(id).c`; very dark colours → #8b8f99 accent), a hover/focus/tap card `.stip` (name · role · job from `CREW_INFO`, EN/AR) and `aria-label`; hidden cards are `display:none` so they never overflow. `crewTipSide` anchors the card to the nearer edge (RTL-aware). Hover/tap plays the bot's own `st-done` reaction + a pulse in its colour (`crewReact`).
- In the prompt box: 52 px bots on a halo, 8-column grid (4×2 on phones).

## v47 Type safety · coins · languages
- Crew names & roles are localised (replaces the v32 "English names everywhere"): Arabic in `AGENT_AR`, other languages in `CREW_T` (names transliterated for non-Latin scripts, roles translated). The `L` wrapper also composes "Name · Role", "Name · Role. description" and "Name will handle this · Role" (`HANDLE_T`).
- Costs: any "N cr" text becomes `<span class="crc">N + coin icon</span>` (`nooiCoins`, MutationObserver) — don't write "cr" labels in new UI; the observer converts them anyway.
- Sign-in has no guest option (button stripped from `vAuth` and hidden by CSS). Logo: 52 px (46 phone top bar, 54 sidebar, 58 desktop landing).
- Typography rules (all languages): no letter-spacing on Arabic-script text; headings in Arabic/Persian/Kurdish/Thai/Tamil/Hindi/Amharic get line-height 1.38; minimum label sizes (badges 11.5, tags 10.5, thumbnail tags 11, crew notes 11–11.5 px); `--mono` includes IBM Plex Sans Arabic/Vazirmatn so mono labels with Arabic use a real font; grid text columns use `minmax(0,1fr)`.
- Landing: "Your AI film crew" section (`nooiLandingCrew`, `#lp-crew`, nav link). Interface language count comes from `UI_LANGS.length` (26).
- First visit: Arabic browsers/time zones open in Arabic; other detected languages (browser language, else time zone → `TZ_LANG`) get a banner asking in their own language (`LSG_T`) to switch or keep English (`nooiLangBanner`, answered once: `S.langAsked`).
- Shipped translations: `i18n/en.txt` + `i18n/<lang>.txt` (numbered lines) → `node i18n/build.mjs` → `public/i18n/<lang>.json` (marketing page, sign-in, navigation, home / prompt studio, composer status — 348 strings × 24 languages). The UI loads them instantly (`nooiSeed`); `build.mjs --check` runs in the test suite. When you add or change a landing/sign-in/nav string, add it to every `i18n/*.txt` and rebuild.
- Everything else is translated by the server's shared cache (`lib/uit.js`, `GET/POST /v1/ui-t/:lang`): translated once per language by the platform's text AI for all visitors, no user credits, only strings that literally exist in `public/index.html`, max 210 per call, 60 calls / 10 min per IP; cache in `data/ui-t.json`. Dialect variants (fr-ca, ar-sa…) still use `/v1/llm/json` per user. Without a text-AI key those strings stay English (the shipped files still cover the landing page). Test: `node tests/uit_mock.mjs`.
- Structured prompts: `parseBrief` maps labels shown in the visitor's language (from `UI_T`) back to the English keys (`BRIEF_LABELS`), so "Idée :" / "シーン：" lines parse like "Idea:" / "Scene:".
- Layout fixes: story workspace columns scroll on desktop (long chapter lists no longer run under the timeline); timeline chips "01 00:08"; logo also in the 1080–1279 px rail; landing crew cards top-aligned.

## v48 Admin access · sign-in link · email posters
- Admin role: `loadMe()` now re-runs on every Firebase auth change (it ran once ~1 s after load, before the session was restored → admins saw no dashboard/CRM/ERP). Server `roleOf` only trusts **verified** emails (`email_verified` in the ID token / `profile.emailVerified`) — an unverified email/password account for admin@… gets no role. Owners & admins (`isStaff`) get the Studio plan in `/v1/billing` and run jobs without plan limits or credit charges.
- Account page: `profileCard` (name, sign-in method, role pill, Admin dashboard button, Sign out).
- Email sign-in: the link carries `?e=<email>` so it completes in any browser/device; errors (expired/used link, other address) are shown on the sign-in screen instead of silently returning to the landing page. `POST /v1/auth/email-link` sends the link with the branded "signin" poster when `FIREBASE_SERVICE_ACCOUNT` + an email provider are set (rate-limited 10/h per IP, 5/h per address); otherwise the browser falls back to Firebase's own email.
- Email posters: `public/email-templates.js` (`renderEmail(kind, data)`, kinds signin · marketing · discount · feature · holiday · plain; ar/en; holidays eid · ramadan · national · founding · newyear · generic) — imported by the server (`/v1/admin/email` with `template` + `fields`, segment `me` = test to yourself) and by the admin Emails tab for a live preview. Previews: `docs/email-posters/`.
- Small fixes: copy buttons use a copy icon; Visual-effects tabs show the open tab clearly (`.seg.fxtabs`); menu "UGC ads".

## v49 Email code sign-in · no phone · credits button
- Root cause of "Send code → back to the home page": the sign-in screen shows only while `AU.showAuth` is true, and the email handlers replaced `AU` without it. Every `AU={…}` inside the sign-in flow must keep `showAuth:true`.
- 6-digit email codes (`lib/otp.js`: HMAC-hashed, 10 min, 5 tries, one-time): `POST /v1/auth/email-code` emails the code (signin poster with `code`), `POST /v1/auth/email-verify` returns a Firebase custom token (`customTokenForEmail`: finds/creates the user as verified; an existing unverified account gets a new random password and revoked sessions first) → `signInWithCustomToken`. Needs `FIREBASE_SERVICE_ACCOUNT` + an email provider; `/v1/config.emailCode` tells the UI. Without them the email-link flow is used. Test: `node tests/otp_mock.mjs`.
- Phone/SMS sign-in removed from the sign-in screen.
- Credits button `crBtn()` (`.crbtn2`): same size as the language/theme buttons in the phone top bar and desktop sidebar header (icon-only in the tablet rail), count-up + coin spin when credits change, opens Credits & transactions (`wallet`).

## v50 On-device AI (WebGPU)
- `public/local-ai-worker.js` (module Worker) runs open models in the visitor's browser with Transformers.js v4.3.1 (loaded from `/vendor/transformers/` when `@huggingface/transformers` is installed in node_modules, else from jsDelivr — not committed: GitHub push protection flags the minified bundle as a false-positive secret) on ONNX Runtime Web — WebGPU when a real GPU adapter exists (SwiftShader/fallback adapters count as CPU), WASM otherwise; a WebGPU failure retries once on WASM.
- ORT wasm/mjs files are served by our server at `/vendor/ort/` from `node_modules/onnxruntime-web/dist` (exact version pinned in package.json — must match what transformers.min.js expects). `/v1/config.localAI = {ortBase, modelsHost, models}`.
- Models download once from Hugging Face in the user's browser and are cached (Cache Storage "transformers-cache"). Optional mirror: set `MODELS_DIR` → served at `/models/`. Override model ids with `platform().localModels`.
- Routed locally (cost 0, no upload of inputs): subtitles transcription (`subs-transcribe` → Whisper base → `importSegments`), voice TTS (MMS-TTS, 12 languages via `laiTtsLang`), background removal for images (MODNet), image upscale 2×/4× (Swin2SR). Depth (Depth-Anything v2) is wired in the worker but not exposed yet. Any local failure falls back to the server job.
- Still need provider APIs: video/image/music generation, lip-sync, video background removal, voice cloning (models too large for browsers).
- UI: Account → "On-device AI" card (device status, toggle `S.localAI`, "Remove downloaded models"); `laiChip` on subs/voice pages. i18n lines 367–377.
- Not testable in the sandbox (Hugging Face blocked) — verify real inference on a real browser after deploy.

## v51 Pro editor (all in the browser, no APIs)
- Six new editor tabs (block "v51" in index.html, helpers prefixed `edx`/`EDX`): Motion & zoom, Color & VFX, Sound FX, Auto captions, Erase & blur, Layers & keying. Text tab gains text effects + word animations; Clip tab gains pro transitions and precision edits.
- Motion: per-clip keyframes `clip.mo={kf:[{t,s,x,y,r}],ease,focus,fh,fv}` (t = seconds inside the clip). Presets: slow zoom in/out, punch-in at playhead, snap zoom, pans, Dutch roll. Tap the preview to set the zoom focus.
- Color & VFX: `clip.cg={exp,con,sat,temp,tint,look}` (11 looks = CSS filter + blend overlay) and `clip.vfx` toggles (shake, beat zoom, RGB split, glow, radial blur, pixelate, mirror, strobe, invert, comic, VHS, light leak). Applied in a `drawFit` wrapper that maps the media back to its clip (`edxClipOf`).
- Transitions zoom/whip/spin/flash/glitch/wipe/blur work across the cut (out on the clip, in on the next) — also in `drawFit`.
- Regions `S.ed.regions` (erase = push-pull fill from the surroundings, blur, pixelate, black box; rect/oval; optional tracking reuses `runTrack`) and layers `S.ed.layers` (image/video PiP, green/blue/custom chroma key with spill removal, AI cut-out via on-device bg model, shape, blend, entrance) are painted from an `overlayVignette` wrapper so they sit under texts/captions/logo. Layer files persist as `ly_<id>` slots.
- SFX `S.ed.sfx=[{id,n,t,vol}]`: 18 sounds synthesised with OfflineAudioContext + uploads (`sx_<id>`), played through `EDX.bus`; `edExport` wrapper connects the bus to the recording.
- Captions `S.ed.caps` — word timings from on-device Whisper (`onnx-community/whisper-base_timestamped`, `return_timestamps:"word"`), falling back to segment timings spread over words; also from the Subtitles page or typed text. Six styles (pop, karaoke, box, bounce, one word, classic).
- Shortcuts: Q/W trim start/end to playhead, F freeze frame (2 s still). Undo covers all new layers (`edxSnap`).
- New strings use `L(en,ar)`; other languages come from the shared runtime translation.

## v52 Slow motion · SAM-style 3D & body on device · Kie AI quick start · white light mode
- Slow motion (Clip tab): 1× / 0.5× / 0.25× / 0.125× / 0.1×; speed ramps (`clip.ramp` in/out/bullet, `clip.slowTo`) remap output→source time with a smooth curve (`edxRampR`, wrapped `edAt`); `clip.speed` holds the ramp's average speed so `clipDur` stays right. Smooth frames (`clip.smooth` blend/flow) read up to 121 frames once (`EDX.sm`), then blend or motion-compensate (8×8 block flow on a 96-px grey image) in `edxSmooth`, fed to `drawFit` as a canvas "video". Start/end frame: frame step (, .), set start/end (I/O), "New AI shot from these start & end frames" loads `vStart`/`vEnd` and opens Video.
- 3D Studio is back on (`GPU_FEATURES=true`). Without a SAM 3D server (`API.cfg.providers.sam3d`) everything runs on the device: SlimSAM (`Xenova/slimsam-77-uniform`) point selection (`sam-embed`/`sam-decode` in the worker), Depth Anything (`depthraw`) for shape, ViTPose (`onnx-community/vitpose-base-simple`, `pose`) for the body → closed textured mesh (`edx3dMesh`) + skeleton → GLB (kept in IndexedDB `x_<id>`). Server-only actions (new camera angle, 3D tracking, 3D reference, place3d) stay hidden until the server is connected. Fallback when AI is off: flood-fill mask + distance relief ("basic").
- Motion capture runs on the device when no mocap server: ViTPose per frame (10 fps, ≤20 s) → smoothing → 3D by bone-length foreshortening → BVH (`bvh_<id>`), keypoints JSON (`kp_<id>`), mannequin video; skeleton overlay on the performance video.
- three.js: CDN first, then `/vendor/three/` served from npm `three@0.128.0`.
- Admin → AI providers → "Kie AI quick start": paste key → saved encrypted + tested (`/v1/admin/providers/kie`, `/test`), "Switch on all supported models" maps every studio model to a Kie id (`kiePlan`) via `modelCat.kieModel`, then "Test an image" / "Test a 5 s video".
- Light mode background is pure white (`--bg:#ffffff`).
- `tests/pro_tools.py` (in `npm test`): every editor tab, 3D studio, mocap and the Kie card on desktop and phone, every control clicked with on-device AI mocked — errors must be [].

## v53 Kie AI runs every model · real logos on every model tile
- `providers/kie.js` `KIE_BUILTIN` + `kieAuto(cap, body)`: when a model's own provider has no key (or a flagship has no API id), video/image/music jobs run on Kie AI as soon as the Kie key is saved. Order: Admin → Models Kie id → admin default model (generic route) → built-in map. Start frame → image-to-video variant; reference image → edit variant. Midjourney via Kie (`mj:7` → `/api/v1/mj/generate`, `/api/v1/mj/record-info`). `/v1/config.providers` counts Kie for video/image/music. Voice/lipsync etc. never go to Kie.
- `tests/kie_e2e.mjs`: mock Kie server + real nooi server (`KIE_API_KEY`/`KIE_BASE_URL`), 9 jobs through `/v1/jobs` to `/media`.
- Logos: full-colour Lobe Icons marks (MIT, trademarks of their owners) in `LOGO_SRC`; `applyLogos()` after every render puts the logo in each model tile (`[data-set$=".model"]` …); `logoFor` (now `let`) guesses by model name for new ids. "Image 2.5" is shown as Seedream 4.5 (what it runs on).

## v54 Kie AI for every tool · Higgsfield/Dreamina-style create & Explore · 3D bots
- Kie inputs follow each model's schema (docs.kie.ai, cross-checked with the MIT `@apicity/kie` registry): required fields (Kling 3.0 mode/multi_shots/multi_prompt/kling_elements, Flux resolution, Seedream quality, Seedance web_search…), field names (GPT Image/Flux edits `input_urls`, Qwen `image_size`, WAN 2.7 `ratio`), aspect ratios snapped to each model's list (`snapAR`), the user's resolution (`pickRes`). Uploads are sent as `PUBLIC_BASE_URL` + `/media/…`.
- Kie also runs: voiceover (ElevenLabs multilingual v2), sound effects (ElevenLabs SFX v2), background removal (Recraft), upscale (Topaz image/video), lip-sync (Kling avatar from a face image; Volcengine for a face video; a typed script is voiced first). On-device AI is only the fallback when a server provider is connected.
- New Kie-backed models: video Veo 3.1 / Veo 3.1 Fast / Grok Imagine / PixVerse V6 / Kling 2.6 / WAN 2.7; image Seedream 5.0 Pro / Imagen 4 Ultra / Ideogram V3 / Grok Imagine / Flux 2 Pro (prices in lib/billing.js, tiers in lib/plans.js). `/v1/config.kieRoutes` = studio model → Kie model (tile tooltips, status badges).
- Home (signed in) = "What do you want to create?" + `hfBox()` (tabs Agent/Video/Image/Audio/Avatar, reference slot, model sheet with logos, ratio+resolution sheet, duration, count, credits, send) → existing tools (`makeVideo`, `makeImages`, voice/music/sfx jobs, lipsync, `uniRun` for Agent). Feature cards (TOP/NEW/POPULAR), What's new, Showroom; the old prompt studio is under "Advanced studio" (`S.homeAdv`). The same box sits on the landing page (send → sign in, prompt kept).
- Explore (`discover` view, `lib/explore.js`): public feed of shared generations (GET /v1/explore, POST share from My library, like, staff feature, owner/staff delete, moderation, 30/day). Masonry cards, videos play in view, Recreate fills the box. Examples (animated previews) until real items exist.
- 3D bots: `botSVG` wrapper adds key light + rim light clipped to each body, glossy eyes, soft ground shadow, pointer-follow tilt (classes unchanged).

## v55 Results under the home box · model logo row · tidier Images page · Kie fallback & admin error detail
- Home box (`hfBox` wrapper): Video/Image tabs show a row of model logo buttons (`hfMRow`, `HF_TOP`): nooi Auto first, the popular models, then "All N" (the full sheet). The Agent chip reads "nooi Auto". `MODELS.auto` / `IMG_MODELS.auto` names now start "nooi Auto · …".
- `hfSend` wrapper: for video, image, audio, avatar (and agent prompts that detect as content/product ad/image) it swallows navigation and collects the new job ids (`HF_GRAB` via an `addJob` wrapper) into `S.hf.out`. `hfResults()` renders them under the box (progress, error, media). Approve (`hfr-ok`): video → editor timeline, image → Images page with it selected, audio/avatar → Voice. Also `hfr-again` (same settings), `hfr-x`, `hfr-clear`. Multi-step agents (film crew, story…) still open their own page.
- Images page (`VIEWS.image` wrapper, DOM regrouping in a `<template>`, no behaviour change): prompt + reference side by side, tools row, then Aspect, Images per prompt, Style, Model and Font as full-width groups (`.ipage`). Only the first 8 model tiles show until "All models" (`S.imgAllModels`); the chosen one always shows. Generate is sticky. The site-wide `balanceGroups` (`.tcenter`) still sizes the tiles.
- Server: `fail()` first calls `fallback()` — a Kie job (prov `kie@…`, image/video, not a part of a long video) that fails for any reason except auth/quota/time-out is resubmitted on the next Kie model (`KIE_FALLBACK`, up to 3 models in total), so one model's outage or input rule doesn't refund the user. Every final failure is logged with `console.warn` (see `journalctl -u nooi`).
- `publicJob(j, staff)`: owners/admins also get `via` (the provider that ran it) and `detail` (the provider's raw error, plus any fallback attempts). The client keeps them and the failure toast shows "Admin detail: …" — the way to see why Kie rejected a job.
- Kie Base URL: `kieBase()` turns the kie.ai website/docs address or a pasted `/api/v1` into `https://api.kie.ai` (a live server had `https://kie.ai` saved → every call got the site's Next.js 404 page). An HTML reply now throws a short "answered with a web page" error marked `noFallback` (kept through `classify`), and `errorDetail` strips HTML.
- Tests: `tests/home_results.py` (model row, results under the box, Approve targets; phone + desktop); `kie_e2e.mjs` adds a forced Nano Banana failure that must finish on Seedream and checks `via`.

## v57 nooi stars for credits & loading · transparent logo · rail & box fixes
- `STAR_D` (three four-point stars, quadratic curves) filled with `url(#nooiStar)` — a logo-gradient (#6EC046 → #9CD245 → #D2E33C) defined once in a hidden SVG. `ICONS.coin` is now these stars, so every credits symbol (top bar, rail, costs, model tiles, wallet) shows them; `.crbtn2 svg` no longer paints a gold coin.
- `STARS("load")`: twinkling stars replace the spinner in the home results cards (`hfrCard` wrapper). With no provider progress the "0%" is hidden and the bar runs indeterminate. Error detail is stripped of HTML (also for jobs saved before the server fix).
- Home hero logo uses the transparent vector mark (`logoFor("auto")`) with a soft drop-shadow, no tile. The box's "+" chip is gone (the Reference slot does that). Rail (768–1279 px): credits show stars + number, controls centred.
- `setObj` guard: a 3D model that finishes loading after the 3D view closed is skipped (was "reading 'add' of null").

## v58 Top-ups · gift cards · redeem codes · invoices · promo emails
- `lib/billing.js`: `itemInfo(item)` prices anything beyond `CATALOG`: top-ups `cr200…cr1200` (`TOPUPS`) and any amount `cr:N` (50–100,000; `creditPrice` tiers 4.5/4/3.5/3 halalas per credit, USD = SAR/3.75), gift credits `gift:cr:N`, gift plans `gift:plan:<basic|pro|studio>:<1|3|6|12>` (`GIFT_MONTHS` 1/0.95/0.9/0.8). The payment keeps a snapshot (`snap`) and the gift details; `finishCheckout` is serialized per ref (return page + webhook can't double-apply) and makes the gift and the invoice. `PAYMENT_TEST=1` adds a fake `test` provider for automated tests only.
- `lib/gifts.js`: codes `NOOI-XXXX-XXXX-XXXX` (crypto, no 0/O/1/I), valid 12 months, one use. `POST /v1/gifts/redeem` (8 wrong tries / 10 min per account; claim-then-apply). A plan gift sets or extends the plan and adds its monthly credits (`planYearly` refills months 2+); on a bigger active plan it becomes credits. Buyer can email a card (`/v1/gifts/:code/email`, 20/day). Staff promo codes: `GET/POST /v1/admin/gifts` (Admin → Payments panel).
- `lib/invoices.js`: invoice per paid checkout, `NOOI-<year>-<seq>`, VAT inside the total (`VAT_RATE`, default 15), seller from `COMPANY_NAME / COMPANY_VAT / COMPANY_CR / COMPANY_ADDRESS`; receipt emailed when email is set up. `GET /v1/billing/invoices(/:no)`, `POST …/:no/email`.
- `public/email-templates.js`: new kinds `gift` (recipient card + code + redeem link), `receipt` (invoice table), marketing `giftpromo` and `topup` (in the admin poster picker; bulk email refuses `gift`/`receipt`). `renderInvoice()` = the printable invoice the site shows in a sheet (Print / save as PDF, Email it to me).
- Client (`v58` block): Wallet gets Top up (200/500/800/1200 + any amount with live price), Gift cards (builder sheet: credits or plan × months, 4 designs, to/from/email/message, live card preview), Redeem a code, Gift cards you bought, Invoices. `creditsSheet` (not enough credits) shows the top-up tiles. `giftCanvas()` draws the 1200×760 card (logo, stars, value, names, message, code); `gfPop()` = animated pop with star burst → Save picture (PNG), Copy code, Share, Send by email. Links: `?gift=CODE` after paying (opens the card), `?redeem=CODE` (from the email, pre-fills the code), `?inv=NO`. `window.BOOT_Q` keeps the query before the paid handler clears it.
- Tests: `tests/gifts_e2e.mjs` (21 checks, throw-away data dir).

## v59 Redeem from the top (sign up first) · client IDs · provider name hidden · avatars · engine-based plans & prices
- **Provider name never reaches the browser.** `server.js` middleware rewrites every JSON answer (`kie`→`engine`, `kieModel`→`engineModel`, `kieRoutes`→`engineRoutes`, "Kie AI"→"AI engine", `kie@x`→`engine@x`, kie.ai URLs removed) and maps `/v1/admin/providers/engine…` and `modelCat[id].engineModel` back. The browser bundle uses only the neutral names (`engQuick`, `engPlan`, `ENG_*`, `data-eng`, `eng-*` acts, admin card "AI engine"). `kie_e2e.mjs` fails if any API answer or downloaded file mentions the provider. Server code, env vars and this file still use the real name.
- **Client ID**: `store.user()` gives every account `cid` = `N-100001`, `N-100002`… (counter `db.cidSeq`, saved at once). In `/v1/me`, `/v1/billing`, admin client rows, invoices (Billed to). UI: chip on Account and Credits pages (tap to copy).
- **Redeem from the top**: `.gfstrip` ("Have a gift code? Redeem gift code") on the landing page (signed out) and home; 🎁 button next to the credits. `gfOpen()` sheet → signed in: redeem; signed out: code saved (`S.gfPending`), sign-up opens, and a watcher redeems after sign-in. Every redeem ends in the animated card with "Congratulations! 🎉 — We're waiting for your talent to amaze the world." `?redeem=CODE` while signed out opens the sheet.
- **Avatars**: 12 realistic fictional people (Saudi, Gulf, Arab, African, Asian, European, Latina; ages 21–62) in `SHOWCASE` with `cat:"avatar"` (photoreal Nano Banana Pro portraits, "a fictional person, not any real individual"). Admin → "Make the 12 avatars" (`{group:"avatars"}`); not posted to Explore; `GET /v1/avatars` lists made ones. Home box → Avatar tab shows them as round faces; picking one sets the face (`M.hfRef.remote`, `serverSubmit` sends `remote` URLs without uploading).
- **Plans & prices follow the engine**: stand-in models are aliases of the engine model they always ran on (`ALIAS` server / `M_ALIAS`,`I_ALIAS` client: ltxfast→seedance, wan22/qwenwan/hunyuan→wan27, ltx23→veo31f, kling40→kling30, sdxl→img25, flux→flux2, qwen2→qwen) — hidden from every list (non-enumerable in `MODELS`/`IMG_MODELS`), still valid for old projects. Studio flagship is Veo 3.1 (was "Kling 4.0"). Plans: Free = Seedance Fast · WAN 2.7; Basic + Kling 2.6 · WAN 3.0 · Seedance 2.0 · MiniMax · PixVerse 6 · Grok; Pro + Kling 3.0 · Seedance 2.5 · MiniMax H3 · Veo 3.1 Fast; Studio = all.
- Prices: `ENGINE_COST` (USD per 5 s video / image / job — estimates) × `priceFactor` (default 1.5) ÷ `CREDIT_FLOOR_USD` (0.0053 = Studio plan credit) → `basePrice()`; admin per-model price overrides still win. `/v1/config.prices` = `priceTable()`; the client applies it (`applyPrices`, same table built in for demo) and fixed jobs (voice, music, sfx, bg, upscale, lip-sync) take their cost from it. Admin → AI providers → "Pricing vs engine cost": edit real costs from the engine dashboard + margin (`GET/PUT /v1/admin/pricing`).

## v60 Faster jobs · scene lock with a vision check · nooi Studio 2.0 (bots, 30 s with any model) · one model chip · durations
- **Speed**: jobs are polled in parallel every 2.5 s (`pollOne`, was one by one every 5 s); with an https `PUBLIC_BASE_URL` each engine task gets `callBackUrl` → `POST /v1/engine/cb/:id/:sig` (HMAC of the job id) polls that job at once (body never trusted). Parts of long videos start 1.5 s after the previous one. The browser follows the box's jobs every 1.5 s and shows an estimated progress instead of a frozen 0%.
- **Scenes** (`lib/scenes.js`, `jobHooks.before/done` in `lib/jobs.js`): `meta.scene` adds a strict "same world" rule + the scene bible to the prompt and starts the shot from the scene's latest picture (image reference / video start frame). The first result is the anchor; every later result (video: its last frame) is checked against it — Claude vision through the existing `llm()` helper when the text AI is connected (score 0–100, differences), otherwise a 4×4 colour-layout comparison via ffmpeg. Below 62 the job is made again once (`restart`, no new charge) with the differences named. `GET/POST/PATCH/DELETE /v1/scenes`; `publicJob` adds `scene` + `sceneCheck`. Box: "Scene: off" chip → sheet (No / new scene / continue a previous one with thumbnails); result cards show "Scene anchor", "In scene · 92%", "Re-making to stay in the scene".
- **nooi Studio 2.0**: the model row is now [nooi] [Model ▾ (sheet)] [Bots] [Scene]. nooi (= auto) shows the 8 animated bots in the box and allows 5–30 s with any model: longer than a model's shot (`ENG_MAX`) → connected parts (`meta.parts`), and when the text AI is connected the Director plans one shot per part (`meta.shots` + `meta.bible`, used by `createJob` for each part). A chosen model only offers the lengths it supports (duration sheet 5–30 s, plan limits shown locked).
- Result videos autoplay muted on screen with small play/pause + full-screen buttons (no big native overlay); the rail credits/gift buttons are smaller.
- Tests: `kie_e2e.mjs` covers scenes (anchor, scene rules + reference on the next shot, check score, scene list; server now runs with `PUBLIC_BASE_URL`); `home_results.py` checks the nooi button, bots and 30 s.

## v61 Sound on result videos · wallet icons · bigger, brighter bots
- Result videos get a sound button (`.hfvm`, toggles `muted`, `.hfrm.sound`); wallet section headings size their icons (`.gfh>svg`).
- The box's bots: one row of 8 on tablet/desktop, 4 + 4 on phones (`.hfbots .botstrip` grid), 60 px, stronger saturation/glow (more in dark mode).

## v62 Audio player · real audio prices · bots follow the pointer · Bots keep the chosen model
- Audio results (voice/music/sfx) use a compact player (`hfAudio`): play/pause, a wave you tap (or arrow keys) to jump, "played / length" time, sound on/off; one clip plays at a time and a playing clip survives re-renders. The card is no longer 16:9 (`.hfrc.aud`).
- The Audio tab shows examples for the chosen type (`HF_PH.audio_music/audio_sfx`, `hfPhKey`) and the real price from `PRICE_TABLE.fixed` (voice 9 · music 17 · sfx 6; avatar = lipsync 108) instead of the old 3/4/1. A voice prompt like "Warm voiceover: Welcome…" speaks only the words after the colon.
- Cards being made show a live seconds counter ("0:23 · ~1:30", `.hfel`); the progress estimate is per kind (music 90 s, voice 15 s, sfx 20 s).
- Bots: the [Bots] chip only toggles `S.hf.bots` (`hfBotsOn`) — it never switches the model back to nooi. With the bots on, any chosen model gets 5–30 s (connected parts + Director plan); with them off it gets its own `ENG_MAX`.
- Every visible `svg.bot` turns and looks toward the mouse or finger (`--rx/--ry` tilt, `.eyes` `translate`), leans in when close (`.near`) and hops when tapped (`.boop`); off with `prefers-reduced-motion`.
- Tests: `home_results.py` checks Kling 3.0 stays picked with Bots off/on (15 s / 30 s) and the audio card (height, icon size, play/sound buttons, time, example, price).

## v63 Engine price list · 25% margin · models ranked strongest → lightest
- `ENGINE_COST` (lib/billing.js) uses the engine's published prices where known (per 5 s of video / per picture / per run; 1 engine credit = $0.005): Veo 3.1 $1.275/8 s, Veo 3.1 Fast $0.325/8 s, Seedance 2.5 $0.085/s, Kling 3.0 $0.07/s, Seedance 2.0 $0.057/s, Kling 2.6 $0.28/5 s, Hailuo $0.15/6 s, Grok Imagine $0.0225/s, Nano Banana Pro $0.09, GPT Image 2 $0.05, Seedream 5 $0.035, Suno $0.06. The rest are estimates — correct them in Admin → AI providers.
- Default margin `priceFactor` = 1.25 (25% over engine cost, measured at the cheapest credit $0.0053; bigger packs earn more). A factor saved in Admin overrides it. The client `PRICE_TABLE` is the same table for the offline demo.
- The model sheet sorts by credits (strongest first, nooi Auto on top), marks the top 3 and shows each model's strengths (`MFEAT`); admin pricing rows are sorted by credits too.

## v64 Drag through audio · ±5 s · use a finished avatar elsewhere
- Audio cards: press and drag the wave with a finger or the mouse to move back and forth (pointer capture, `touch-action:none`); −5 s / +5 s buttons beside the time.
- Avatar (lip-sync) results remember the face (`AVF` in memory, `meta.face` when it has a URL) and offer "Use this avatar in": video scene, UGC ad (video 9:16, `S.draft.type="ugc"`), poster (image 3:4), social post (image 1:1) or a new line — each fills the box with the face as reference and a ready description.

## v65 Photo × · avatar face from several angles · bots that learn · nooi Studio 2.0 mixes models per shot
- The box's reference photo has an × (`hfz-rm`). Avatar tab: up to 3 more angles (`M.hfAng1..3`). With angles on the server, a face portrait is made first from all photos (Nano Banana Pro/2 with `iRef`+`iRef2..4` → `image_input`), then the lip-sync starts from it by itself.
- Learning (`lib/learn.js`): `POST /v1/learn {job, ev}` (approve / again / remove) reads the model(s) and category from the caller's own stored job — never from the browser — once per job+event; failures are learned by the server (`jobHooks.fail`). `GET /v1/learn` → stats per model × category. The browser also keeps local stats (`S.learn`) and sends events from the result cards (`lrnEvent`).
- nooi Studio 2.0 (`hfStudio`): category from the prompt (`hfCat`), score = prior quality (`STU_Q` + `STU_B`) blended with learned approvals + a small bonus for less-tried models; hero shots (first/last, or a single people/action/product/VFX shot) get the best model, middle shots a lighter one (higher cost weight). The plan, per-shot credits and the saving are shown in the redesigned panel; jobs carry `meta.partModels` + `meta.cat`.
- Server: `createJob` routes and checks each part's model (`partModels`), `priceOf` sums each part's price (same as the browser).

## v66 Results → editor · prompt bar in the editor
- Every finished result has "Use in": videos/avatars/images → editor timeline; music → editor background music; voice/sfx → a sound at the playhead (`edUseJob`); images also "Animate it" / "Use as reference"; voice → "Avatar voice".
- Editor prompt bar (`#edcmdq`, `edRun`/`edIntent`): add a shot, an image, music, a sound effect, a voice-over or a title, or change the selected clip (current frame → start frame + "Change: …" → replaces the clip when ready). Results land on the timeline by themselves (`EDP`).

## v67 The bots write the plan · send bar on top · results by type · select many → project / folder
- nooi Studio 2.0 panel: the plan is a list written by the bots (`hfStudioPlanHTML` → `hfBotLine`): Director splits the length, Writer/Cine/Casting/Sound/Editor/Proof say their part, Producer names each shot's model with a small logo (`.mdl`). The bar with length, ratio, credits and send sits above the bots panel. The Agent tab and its chip show the nooi logo.
- Results are grouped (Videos · Avatars · Images · Audio; audio cards wider). "Select" (`S.hf.selMode/sel`) picks many → "Add to a project" (new edit project with all of them: clips, background music, sounds one after another; or the open edit) or "Add to a folder" (`S.folders`, shown in the Library with "Open as project").
- Audio time stays on one line (tabular numbers).

## v68 ChatGPT connection with its logo + "Test connection"
- Integrations: Claude, ChatGPT and Qwen show their own logos; ChatGPT has setup steps (Developer mode → connector → URL with token, no extra auth). "Test connection" (`mcpTest`) creates a temporary token, runs initialize → notifications/initialized → tools/list → tools/call nooi_credits and a wrong-token check, shows each step, then deletes the token.
- `/mcp`: a `nooi_…` token that doesn't match is always refused (even in local no-sign-in mode). `tests/mcp_chatgpt.mjs` does ChatGPT's handshake against a fresh server (own data folder) — part of `run_all.sh`.

## v69 Home order · templates · length slider · ratio tiles
- Home: box → "Claude & ChatGPT · Connect" pill (both logos) → results → tools → the rest; the "Recent" section is gone.
- Template cards: title, one clear sentence (`TPL_D`), then type · length · format pills.
- Video length: one slider 0–30 s (Dreamina style) with ticks and a number box; drag is smooth, it snaps to 5 s on release, the chip/credits update live; beyond the plan is dimmed.
- Ratio tiles: the shape on top, the numbers under it (`.ratio2`), so "9:16" never overflows.

## v70 Editor that works by touch · real export · no demo content
- Timeline (`TLX`, window-capture pointer layer that runs before the older handlers): tap anywhere (not on a clip) → playhead moves; drag on the ruler/playhead → scrub; swipe on the tracks scrolls; tapping a track never adds anything (empty tracks show real "+ Text" / "+ Music" buttons). Phone preview capped at 40vh so the timeline and tools stay reachable; clip sliders run left→right. Preview shows "Loading…" / "still being made" instead of "missing".
- Saving files on the website (`saveFile`) is a normal browser download (it only worked inside Claude before). Export on the server: the recording is converted by `/v1/media/transcode?w&h&fmt` to the exact format size (scale+pad), MP4 H.264/AAC by default (WebM VP9 optional) with a proper duration.
- No demo on the live server: demo-clip / demo-source buttons removed, CRM/ERP start empty (old sample deals/expenses cleaned), decorative cards (`thumb` refs `s:`/`t:`) use real media — showcase, community posts or the user's own results — else a clean nooi card. Home tools grid 4 columns (2 on phones).
- `tests/editor_real.py`: fresh server with its own data/media, real files from ffmpeg, phone (touch) + desktop (mouse) checks of every editor tool and the MP4 export (1080×1920, sound, length). Note: the headless test browser can't decode H.264, so test clips are WebM.

## v56 Showcase: nooi's own marketing videos & pictures made with Kie AI
- `lib/showcase.js` → `SHOWCASE`: 21 curated prompts (English + Arabic): motion (desert flyover, neon drift, coffee pour, volcanic shore, perfume UGC ad), anime (rooftop run, sakura samurai, rainy window, fox chef), VFX (shattering tower, fire portal, liquid chrome, time freeze), pixel-art animation (knight, night city, island) and 5 pictures. Each has a studio model id (routed to Kie), aspect, category, and `slot` 0–5 for the six demo tiles.
- Admin → AI providers → "Showcase for marketing" (`scAdmin`, appended to `kieQuick`): "Make the showcase with Kie AI" → `POST /v1/admin/showcase {ids?, force?}` creates staff jobs (no nooi credits; uses the Kie balance). A 4 s watcher turns finished jobs into records (`col("showcase")`) and posts each to Explore as featured, author "nooi", with its prompt (`showcase` field). `DELETE /v1/admin/showcase {ids}` removes records + posts. Per-row remake (`sc-one`), "Retry failed", live status.
- Public `GET /v1/showcase` → client `scLoad()`: items with `slot` and a URL fill `SHOWREAL` and replace `SHOWCASE[slot]` (prompt + model), and the `thumb()` wrapper swaps the demo canvas for the real `<video class="sv">`/`<img>` everywhere the demo tiles appear (home cards, What's new, landing community, Explore examples). `video.sv` plays only on screen (IntersectionObserver).
- Explore examples (`xpExamples`) come from the showcase list (real media when made, demo canvas otherwise) so every prompt can be Recreated before users share anything. Explore categories gained Motion, VFX and Pixel art (server `EXPLORE_CATS` + client `XP_CATS`).
- Tests: `kie_e2e.mjs` makes three showcase items through the mock Kie, checks /media, the Explore posts with prompts, no double making, and DELETE cleanup. `pro_tools.py` skips `sc-*` buttons.

## Slash commands (in .claude/commands)
`/test` full check · `/audit-i18n` translations & RTL · `/deploy root@IP` update the VPS · `/connect-provider Kling` wire & verify a real provider.

## Status
Done & tested in browser: studio UI (video/image/characters/story/storyboard/editor/subtitles/dubbing UI/hooks/content plan/scheduling/coloring book/live sketch/floor plans → 3D (three.js)/motion tracking/fonts/UGC ads/admin dashboard/support/policies/dark-light), server logic unit-tested (billing, coupons, RBAC, encryption, MCP protocol, routing).

NOT yet verified against real services (no internet in the original build environment) — verify each in sandbox with the provider's current docs:
1. WAN 3.0 request/response mapping (`providers/index.js → wanBody`).
2. Seedance, Kling, DashScope adapters (`providers/extra.js`) — endpoints, model ids, Seedance text flags.
3. Payments: Moyasar/Tap/Stripe/PayPal/Airwallex create + verify + webhooks (idempotency already in place).
4. Firebase sign-in (required before inviting clients — without it the server runs as one local user).
5. Email (Resend/SendGrid) + SPF/DKIM for contact@nooi.ai.
6. Social OAuth apps & publishing.
7. Google Fonts loading and the real 3D floor-plan render on devices.

## Suggested order of work
1. Deploy: `bash deploy/install.sh <domain> <email>` on the VPS (Ubuntu 24.04). Check `journalctl -u nooi -f`.
2. Firebase auth → test sign-in end to end.
3. Text AI key (Claude or Qwen) → test story/storyboard/translation.
4. First video provider (WAN 3.0 or Kling) → real render end to end, then the rest.
5. Payments in sandbox → go live after the payment company approves.
6. Email, social publishing, backups off-site (rclone).
7. Refactor frontend into modules; add automated tests to CI (tests/*.py with Playwright).

## Rules
- Never commit `.env`, `data/`, `media/`. Keep secrets out of logs and chat.
- Keep Arabic/RTL correct: timelines & toolbars that represent time stay `dir="ltr"`; everything else follows the UI language.
- Mobile first: test at 360/390 px, iPad 768/1180, desktop 1440 (`tests/allviews.py`). No horizontal page overflow.
- After UI changes run `npm test` (= `bash tests/run_all.sh`): syntax, click every control (`[]` errors), layout on 4 devices, RTL in ar/fa/ckb, untranslated text, tracking accuracy.
- Never declare a top-level `function` with an existing name — a later declaration silently replaces the earlier one (this broke the audio lab once). `npm test` fails on duplicates. Prefix new helpers (e.g. `crewNormalize`, `alDrawWave`).
- Never compute `L()` at load time (the language may change) — build strings inside functions.
- Setup for tests: `pip install -r tests/requirements.txt && python3 -m playwright install chromium`.
