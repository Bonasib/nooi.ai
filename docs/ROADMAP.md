# nooi — product map and roadmap (v90)

The map of what every page is for, the rules every new button has to follow, what was merged or removed and why, and what
comes next. Every button on every page, with what it does, is in **docs/UI_MAP.md** (made by `python3 tools/uimap.py`).

> **بالعربية باختصار:** صفحة واحدة لكل مهمة. تكتب ما تريد مع خيارات بسيطة، والنواة تختار المحرك الأفضل (Google Gemma، NVIDIA،
> SAM 3D، World Labs، Kie…) دون أن يرى العميل أسماء المحركات. صفحات 3D (عوالم 3D، استوديو 3D، الفيزياء، عالم العمق، 3D المحلي)
> صارت أداة واحدة: **عالم 3D**، حيث تكتب برومبت أو تضيف صورة فتمشي في عالم حي فيه ناس وحيوانات وماء وطقس وفيزياء حقيقية.
> الفيزياء لم تعد صفحة: هي داخل العالم (التقاط، رمي، ركل، كسر الزجاج، الطفو)، وداخل الفيديو (جملة محسوبة بـ MuJoCo تضاف تلقائياً
> للبرومبت)، ومتاحة لـ ChatGPT وClaude. المتصفح لا يُغلق: محرك واحد (WebGPU على Vulkan/Metal/D3D12، وإلا WebGL2) بمستوى جودة
> لكل جهاز ودقة تتبع سرعة الإطارات، والعمل الثقيل على الخادم لا على الهاتف.

## 1. Rules for every page and button

1. **One door per job.** A thing is made in exactly one place. Other pages hand over to it (they don't copy it).
2. **Write what you want + a few simple options.** The prompt is the main control. Options are chips with icons and one
   sentence each (time, weather, format, length). Expert settings are folded away, never in the way.
3. **The core picks the engine.** Customers never choose between NVIDIA, SAM, Google, Kie, World Labs… The server routes each
   job to the best connected engine, falls back to the next one on failure, and refunds what didn't happen. Only Admin sees
   engine names (Admin → Connections).
4. **Nothing heavy on the phone.** AI work runs on the server. The phone only draws, with a quality tier and a frame budget.
5. **Physics is part of everything, not a page.** The 3D World moves with real physics, video prompts get measured physics,
   the AI bots know the physics craft notes.
6. **Honest results.** Every result shows "What the AI received" (the words and settings sent, plus the measured physics line);
   failures say why in one sentence with Try again; costs are shown before a paid step.
7. **Same everywhere.** Same menu on phone and desktop, Arabic right-to-left, every label in the visitor's language, one icon
   set (no emoji; the sparkle only for AI) and one look (§10): a colour per section, one header, one tile, one card.

## 2. The map (hubs → tools)

| hub | tool | what it is for | hands over to |
|---|---|---|---|
| Home | Home | one create box (agent · video · image · audio · avatar) + the main tools + templates | the tool that makes it |
| Explore | Templates · Community · Recipes | start from a ready example, remix a community post, run saved chains of steps | Create video / image |
| All tools | All tools | every tool as one card, by section, with a filter box | the tool |
| Image | Create image | several pictures per prompt, pick the best | Video, Characters, editor |
| | Sketch to life | a drawing becomes a picture, a character or a place | Image, 3D World (floor plans) |
| | Coloring book | printable pages from a film or story | — |
| Video | Create video | words or a picture → video (camera moves, keyframes, length, format) | editor |
| | Cinema Studio | the same video with a film crew's camera, lens and light | editor |
| | Motion Control | a character performs the movement of a video | editor |
| | UGC ads | product ads with a presenter, product shots or motion graphics | editor, Schedule |
| | nooi Studio | eight AI bots write, direct, shoot, score, edit and check a whole film | editor |
| | Chapter story · Storyboard | long films that continue from the last frame; frames on a canvas | Create video |
| Audio | Voice & audio · Subtitles & dubbing | voices, dialogue, music and sound; subtitles, translation and dubbing | editor, Schedule |
| Characters | Characters | people with ages, voices, looks; a full 3D character | Video, 3D World |
| **3D** | **3D World** | **words or a picture → a living world you walk in (see §4)** | Create video, photo, .glb |
| Edit | Video editor · Video from pictures · Visual effects · Enhance · Video intelligence | finish and fix what was made | Schedule & publish |
| Publish | Schedule & publish · Content plan · Hook lab | plan, write openings, post everywhere | — |
| My library | My library | everything made, with "What the AI received" | any tool |
| Settings | Account & plan · Credits · Integrations · Legal · Help | the account; ChatGPT / Claude / Blender / Unity connections | — |
| Admin | Admin dashboard · Connections & APIs | owners only: clients, prices, engines and keys | — |

## 3. Merged or removed in v86 (and why)

| before | now | why |
|---|---|---|
| "AI 3D world" (w3ai), "3D Studio" (studio3d, in a frame), "Physics" page, the depth-photo world, "Local 3D", the old /world3d pages | **one 3D World** page | four doors for one job, and each made its own 3D context — the main reason the browser closed |
| a 3D Studio that ran image AI on the phone (transformers.js) | the phone only draws; plans, pictures and 3D objects are made on the server | phones ran out of memory |
| depth world (one picture pushed into a relief) | **picture → a real world**: the vision AI reads the place, the things in it and where they stand, and the world is built around you (and World Labs makes it photoreal when connected) | a 3D-looking picture is not a place you can walk in |
| Physics page (scene → simulate → preview) | physics inside the World (grab, throw, kick, things break, float and sink) and inside every video prompt (lib/physicsdirector.js) | a page of experiments gave nothing to the work itself |
| engine names on customer pages ("SAM 3D", "Powered by …") | plain words ("the 3D engine on the server"); names only in Admin | one core, no choosing between engines |
| old links (`studio3d`, `w3ai`, `physics`, `w3d`, `l3d`, `/world3d/`, `/studio3d/`) | all open the 3D World | nothing breaks for people with old links |

Still to fold (next): the voice page shows "calm / warm / whisper" twice (voice tone and dialogue feeling) — one feeling
picker for both; the editor's "3D" tab should hand a paused frame to the 3D World instead of keeping its own 3D panel.

## 4. The 3D World (public/world/*, lib/world.js, providers/gen3d.js)

**What you do:** the page opens on an empty stage (nothing is made until you write). Write a world ("a desert oasis at sunset
with camels, a man walks to the tent and two children run") or add a picture of a place, press Create — the world comes to
life in front of you (the land rises, things grow in, life starts moving) and real-looking people do what the words say.
Name your own characters with @ ("@Faisal sits on the bench") and they walk in as themselves. Walk in it.
Write a change ("make it night", "add three horses", "remove the cars") in the same box. Simple options only: time of day,
weather, and the look — **Fast · free** (built on your device from the plan) or **Realistic** (photoreal, paid, made on the server).

**Buttons:** Create / Change · time (Auto, Day, Sunset, Night) · weather (Clear, Rain, Snow, Fog, Storm) · look (Fast · free,
Realistic) · examples · on the stage: walk / fly / orbit / tour, full screen, jump, pick up · throw (E, Q to let go or push) ·
under the stage: Photo, Video tour, Use in Create video, Make it a real photo, Save, Download .glb, New; saved worlds open
again exactly as they were.

**How it is built:**
- *Plan* (public/world/plan.js): words → a world plan (place, size, time, weather, terrain, water, objects with material
  and position, life, roads, where you start). The text AI writes it on the server (Gemma on Google first, then the site's
  other text AIs); `cleanPlan()` keeps every field to a known list and range; words the AI forgot are added back from the
  local reading (English and Arabic); without a text AI the local reading makes the whole plan, free.
- *Picture → world*: the vision AI turns the photo into the same plan — the kind of place, light and weather, every visible
  thing with its type, colour, material, where it stands and its box in the photo — so the world is the place, around
  you, not a picture with depth. Realistic adds the 360° sky and AI 3D models of the main things (cut from the photo by
  their boxes), or a whole World Labs world.
- *Engine* (engine.js): one renderer for the site — WebGPU where it works (on Vulkan, Metal or Direct3D 12), else WebGL2;
  quality tiers (low / mid / high) from the device; resolution follows the frame time; no drawing while hidden; GPU loss or a
  failing WebGPU frame → the same scene goes on in WebGL2 (and that browser starts in WebGL2 for a week).
- *Build* (world.js, assets.js, terrain.js, sky.js, water.js): 80+ low-poly models with vertex colours, instanced per material
  in 48 m chunks (culled), terrain shapes, rivers and lakes, sky by the hour, rain / snow / sandstorm, lights at night.
- *Life* (life.js): animals, birds, fish, cars on the roads (they brake for you), boats — no box people any more.
- *People* (human.js, v87): real-looking 3D people — a character's real face → a full-body photo of that person → a 3D model
  (Model Studio 3D / Tripo / Meshy / NVIDIA); the site's own 8 people are made once by the owner and are free in every world.
  A skeleton is fitted to each model in the browser and the people walk (hip sway, knee bend, arm swing), run, stand and
  breathe, wave, talk, sit on benches and chairs, dance and point; they walk to what the words name, meet who they talk to,
  avoid each other and turn to look at you. Plans carry `people` (who, how many, what they do, what to) from the AI or from
  the words (English and Arabic, Arabic duals included).
- *Physics* (physics.js, Rapier): the same material table as the server (materials.js) — a rubber ball bounces and rolls to a
  stop, glass shatters above its breaking speed, wood floats, stone sinks, wind pushes light things; you walk, climb steps,
  swim and jump with a character controller.
- *Realistic with World Labs (Marble)*: the job returns Gaussian splats (light 100k for phones, 500k for computers), a collider
  mesh, the panorama and a thumbnail, all copied to our server; Spark draws the splats; the collider becomes the ground you
  walk on, with people, animals, weather and physics added on top.

**Budgets (tested):** a world builds in about 0.1–0.3 s after the plan; low tier ≈ 30–55 draw calls and ≈ 20–30k triangles;
the resolution drops before the frame rate does. Phones destroy the engine when you leave the page.

## 5. The create core (one prompt, the best engine)

| kind | who makes it (first connected wins; the next takes over on failure) |
|---|---|
| text / plans / vision | Gemma 4 on Google → your own text server → NVIDIA → Claude / Qwen |
| pictures | the picture engine chosen by nooi Auto (Kie market models, NVIDIA FLUX, OpenAI…) |
| video | nooi Auto (best engine for the prompt, length and plan), with the physics line added (§6) |
| 3D objects / characters / people | NVIDIA TRELLIS (when switched on) → Model Studio 3D (Tripo P1.0 on DashScope, the Qwen key; never named to clients) → Tripo → Meshy (engine "auto"; a Model Studio failure moves the job once) |
| a character in any job | its one real face goes with the job: pictures use it as the identity reference; a video first makes a picture of the scene with that person (@Name in the prompt, or the UGC presenter) |
| 3D worlds (Realistic) | World Labs (Marble) → 360° panorama from the picture engine + AI 3D objects |

## 6. Physics in the work

- **In the world:** Rapier in the browser (§4).
- **In every video:** `lib/physicsdirector.js` reads the prompt (English and Arabic) — a glass that falls, a ball that
  bounces, a stone thrown into a lake, a car braking on a wet road, a flag in the wind, someone tripping, falling or diving —
  runs MuJoCo on the server (free, at most 2.5 s, never stops a job) and adds one sentence with the measured numbers
  ("It falls 0.9 m in 0.4 s and hits the hard floor at 4.2 m/s, then shatters…"). It never names test objects, never
  contradicts the client's words ("it floats" but it would sink → nothing added), and shows the line in "What the AI received".
- **For ChatGPT / Claude:** the physics tool (MCP) with the same limits.
- **For the AI bots:** physics craft notes (lib/skills/physics.md).

## 7. v87 — real characters, one player, the World comes alive

- **Characters are real.** One face per character (its photo, a real look, or a ready presenter's portrait); no drawn previews —
  an empty frame says "Make it real". The face goes with every job that names the character (`@Name` in the home box, Video,
  Image and the 3D World, or the character picked in the Video / Image page's list; the UGC presenter at every step), so the engine shows that person, never a random one.
  Looks of a character that has a face are made from that face (the same person each time); with no face yet, "4 real
  looks" are 4 candidate faces and the first one becomes the face. Each is charged what its picture engine costs.
- **UGC ads:** ready presenters are real photos (the owner makes the missing ones once); face → photo with the product →
  video from that photo, on Kling 3.0 Turbo (faster).
- **One video player** everywhere: play/pause, seek with the time, sound, full screen; one video at a time; the viewer covers
  the page. Results are compact on phones; no percentage numbers.
- **3D World:** empty start, faster plans (12 s for the AI, else the words at once and the AI's richer version offered),
  the world comes to life, real-looking people do what the words say. "Auto" time is daytime again (it was midnight).

## 8. v88 — creating works on phones, clean boxes, pictures in every list

- **Creating works on phones.** A photo is read the moment it is picked and made a 2048 px JPEG, uploaded in the background and
  reused by the job; a dropped connection is tried again; a plain message instead of "Failed to fetch". The server no longer
  restarts on a stray error. Motion Control always sends the engine a prompt.
- **Clean prompt boxes:** no microphone, no resize grip, none of the site's own instructions, empty after a start. The engines get
  the words in English (quoted words kept as written) and videos never show their prompt as text unless the words ask for text.
- **Pictures in every list:** engine logos, character faces (an empty frame when there is none), a clear poster frame for every video.
- **Delete with a confirmation:** × on videos, pictures and characters.
- **Removed:** "Powered by NVIDIA AI", Motion Control 2.6 (3.0 is on Pro too), the UGC name / price / special fields (one line
  about the product). The Images page's Generate bar stays in place.
- **A photo → a World you walk in** from the home box or the World page: the place read from the photo, the photo around you,
  an open floor for an indoor photo.

## 9. v89 — stars instead of numbers, every model in the home box, a tidier codebase

- **Icons never show a number.** Loaders are the stars only; a count shows that many stars and the label says the number;
  the strongest models get a star, a busy crew member a star.
- **The home box lists every model** the Video and Image pages offer, each with its logo (Seedance 2.0 Mini and the others
  added since v83).
- **Failures read clearly:** no play button on a failed preview, the client's own words as its caption, a dropped connection
  in plain words. A result deleted on another device stops showing as "being made".
- **Videos keep showing:** the length sits top left; results still on an engine's expiring link are copied to the server.
- **Privacy:** the public config and the text AI test no longer reveal which provider runs the site.
- **Dead code removed** (≈141 KB of the page): versions of functions that could never run, unused helpers, logos set twice,
  unused CSS and animations.

## 10. v90 — one look

Each page had been built with its own look: colour-gradient app icons on Home, grey squares on Video, green on Sketch; 19 icon
sizes, 7 corner roundings, titles from 14 to 20 px; on a phone the tab row could hide the tab you were on. Now one system:

| part | the rule |
|---|---|
| section colour | Image amber · Video violet · Audio fuchsia · Characters blue · 3D emerald · Edit cyan · Publish rose · the rest nooi green. It says where you are: the tool's icon beside the page title, the cards on Home and All tools, the open menu item. A darker shade in light mode, a lighter one in dark; each is at least 3:1 on its tinted square. |
| choices | neutral; the picked one is always nooi green (on every page, in every section) |
| page header | the tool's icon in its section colour + the tool's name (the same words as the menu and the tab) + one line |
| option tile | one tile: a 32 px neutral square with a 20 px icon and a short name |
| tool card | one card (Home, All tools): icon square in the section colour, name, one line |
| corner rounding | 8 (small buttons, icon squares) · 12 (tiles, fields, drop zones, players) · 16 (panels, cards) — pills and circles aside |
| titles | page 22 px (27 on a computer) · section 16 · card 14 |
| icons | 14 beside small text · 16 beside normal text · 20 standing alone (menu, tiles, cards, headers, toolbars) |
| tabs | one row; the open tab is always in view; a soft edge shows there are more (mirrored in Arabic) |

New places: **Audio** (Voice & audio + Subtitles & dubbing — Edit had seven tabs, now five) and **All tools** (every tool as
one card, by section, with a filter box; Home's Tools title links to it). Checked on every page by `tests/v90.py`.

**The AI agents** are called agents (وكلاء), never bots, and appear in one order everywhere — the order the work runs, each
one working from what the ones before handed over:

| # | agent | role | job |
|---|---|---|---|
| 1 | Quill | Story Writer | turns your idea into the story: scenes, characters and dialogue |
| 2 | Nova | Character Designer | gives every character one fixed face, outfit and voice |
| 3 | Max | Director | splits the story into shots: framing, action, camera move and length |
| 4 | Lumi | Cinematographer | sets light, lens and colour, and writes each shot's final prompt |
| 5 | Echo | Sound Engineer | writes the music, sound effects and spoken lines for every shot |
| 6 | Remy | Editor | joins the shots into one film: order, timing and transitions |
| 7 | Duke | Producer | picks the AI model for each shot and keeps the film within your credits (he prices the final cut) |
| 8 | Iris | Proofreader & QA | checks everything, then approves it or sends it back to be fixed |

The home box's plan had listed them Director first and the Character Designer after the Cinematographer; each agent had two
different job lines; one note still used an old name (Daqiq). Now one list, one job line each, and nooi Studio shows
"Who does what — in the order they work".

## 11. v91 — an editor that works on a phone, a one-button Sketch, nine agents, voices you can hear, a World that looks real

**Video editor.** Keyframes now animate: after "Add keyframe", changing Scale, Position or Rotation at another moment adds a
keyframe there (before, every change overwrote the one keyframe and nothing moved). The keyframe bar has big touch targets,
jumps to the previous / next keyframe and seeks where you tap; keyframes show on the clip in the timeline. Split and Duplicate
make real copies (both pieces shared one set of keyframes and colours). **AI commands** like InVideo AI, in English and Arabic —
the ones the editor can do itself run at once, free, with undo ("delete clip 2", "make it vertical", "slow motion", "fade
transitions between all clips", "music quieter", "black and white", "delete clip 2 and make it square"); new pictures, video,
music, voice and sound go to the AI with their price on the Go button first. **Extend shot**: the clip's last frame starts the
next 5 seconds, placed right after it. On a phone the page header is compact.

**Sketch.** One page (Draw a scene opens it): the drawing, its tools, "What are you drawing?", how many versions (1 · 4 · 6 · 8 ·
10, each in a different look) and one "Preview with AI" button with its price. Nothing happens by itself while you draw (no live
AI, no pictures when you pause, no camera or recording); the drawing is never replaced, undo / erase / redo work on it, and it is
kept after a reload. Drawing is incremental — a pen move costs under a millisecond on a 400-line drawing.

**The agents — nine**, in the order the work runs:

| # | agent | role | job |
|---|---|---|---|
| 1 | Quill | Story Writer | turns your idea into the story: scenes, characters and dialogue |
| 2 | Nova | Character Designer | gives every character one fixed face, outfit and voice |
| 3 | Max | Director | splits the story into shots: framing, action, camera move and length |
| 4 | Lumi | Cinematographer | sets light, lens and colour, and writes each shot's final prompt |
| 5 | **Lyra** (new) | Dialogue & Voice Director | casts a real voice for every character and directs each line — feeling, pace, breaths — for films, shorts, songs and presenter videos |
| 6 | Echo | **Sound Designer** | realistic sound for every shot: effects and foley on the frame, the ambience of each place, music under the voices |
| 7 | Remy | Editor | joins the shots into one film: order, timing and transitions |
| 8 | Duke | Producer | picks the AI model for each shot and keeps the film within your credits |
| 9 | Iris | Proofreader & QA | checks everything, then approves it or sends it back to be fixed |

Lyra has her own icon (a microphone with sound waves) and colour. In nooi Studio she casts one voice per speaker and writes the
lines shot by shot; "Voices, sound & music" makes one dialogue track in those voices plus a realistic effect per shot and the score.

**Character voices.** Every character can have its own real voice from the voice library — chosen on the character page, heard
first (a free sample, or one made once for 1 credit and free for everyone after) — and keeps it in dialogue, storyboards and
films. What makes it sound real: one steady voice per character, a feeling per line, lines rewritten for the ear with breaths and
pauses, the line before and after as context, a real room and even loudness.

**3D World.** Realistic is real now, with only the picture engine connected: a 360° picture of the surroundings that also lights
the world, a seamless photo of the ground, and photo cut-outs of the trees, palms, bushes and cacti in place of the built ones.
It is the default once pictures can be made, with the price on the Create button. Real 3D objects and World Labs still join on top
when they are connected.

## 12. Next — from a look at how Higgsfield is organised

Higgsfield's site could not be opened from the build machine, so this comes from its public help pages and reviews (structure
and feature names only). Nothing of theirs is copied — no icons, pictures, templates, words or code; every page stays nooi's own.

| Higgsfield area (public) | nooi today | what nooi adds |
|---|---|---|
| Explore feed | Explore: Templates · Community · Recipes | — |
| Image (models, edit with a brush, upscale) | Create image · Sketch to life · Coloring book | **Edit picture** (brush + words) and **Expand picture**, in Image |
| Video (many models, camera-move presets) | Create video · Cinema Studio · Motion Control | a short looping preview for every camera move and effect, made from nooi's own renders |
| Audio | Audio (v90) | — |
| Edit (video edit, upscale, background, grade) | Edit: editor · effects · Enhance · Video intelligence | — |
| Character identity from photos | Characters (looks, voices, 3D); scene lock + vision check | **Identity from photos**: 3–20 photos of a person who agreed → one identity in every shot, each shot checked |
| Product ads from a link | UGC ads (from photos) · Content plan (from a website) | **Product link → ad**: name, photos and price read from the product page |
| Apps (one-tap tools) | All tools (v90): 25 tools | one-tap tools in the same page template: lip-sync studio, new angle of a picture, outfit change, product placement, portrait pack from selfies |
| Canvas (chain models) | Recipes (saved chains of steps) | a canvas view of a recipe (steps as boxes you connect) |
| Agent that plans a whole project | the Agent tab · nooi Studio's nine agents | — |
| Assets library | My library | — |
| MCP / CLI for AI agents | Integrations · MCP | — |

Order of work:

1. **v91 — one-tap tools:** Edit picture, Expand picture, New angle, Outfit change, Product placement, Portrait pack,
   Lip-sync studio — each in the v90 page template, listed on All tools, cost shown before the paid step.
2. **v92 — product link → UGC ad**, and the same link fills the Content plan.
3. **v93 — identity from photos** in Characters. Tools that use a real person's face (identity, portrait pack, any face
   change) need that person's agreement and never accept public figures; results carry the AI label.
4. **v94 — preview loops** for every camera move and effect in the pickers.
5. **v95 — canvas view** for Recipes.
6. Still open from before: one feeling picker on Voice & audio; in the World doors, cars and carrying things between saved
   worlds, a "what happened" film, people who talk with your character's voice; picture → world with more model types and
   "keep this object"; template covers from real results.
7. Keep `docs/UI_MAP.md` up to date (`python3 tools/uimap.py`) and every new page inside §1 and §10 (`tests/v90.py`).
