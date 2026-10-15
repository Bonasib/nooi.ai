# nooi — product map and roadmap (v86)

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
   set (no emoji; the sparkle only for AI).

## 2. The map (hubs → tools)

| hub | tool | what it is for | hands over to |
|---|---|---|---|
| Home | Home | one create box (agent · video · image · audio · avatar) + the main tools + templates | the tool that makes it |
| Explore | Templates · Community · Recipes | start from a ready example, remix a community post, run saved chains of steps | Create video / image |
| Image | Create image | several pictures per prompt, pick the best | Video, Characters, editor |
| | Sketch to life | a drawing becomes a picture, a character or a place | Image, 3D World (floor plans) |
| | Coloring book | printable pages from a film or story | — |
| Video | Create video | words or a picture → video (camera moves, keyframes, length, format) | editor |
| | Cinema Studio | the same video with a film crew's camera, lens and light | editor |
| | Motion Control | a character performs the movement of a video | editor |
| | UGC ads | product ads with a presenter, product shots or motion graphics | editor, Schedule |
| | nooi Studio | eight AI bots write, direct, shoot, score, edit and check a whole film | editor |
| | Chapter story · Storyboard | long films that continue from the last frame; frames on a canvas | Create video |
| Characters | Characters | people with ages, voices, looks; a full 3D character | Video, 3D World |
| **3D** | **3D World** | **words or a picture → a living world you walk in (see §4)** | Create video, photo, .glb |
| Edit | Video editor · Video from pictures · Visual effects · Voice & audio · Subtitles & dubbing · Enhance · Video intelligence | finish and fix what was made | Schedule & publish |
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

**What you do:** write a world ("a desert oasis at sunset with camels") or add a picture of a place, press Create, walk in it.
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
- *Life* (life.js): people, animals, birds, fish, cars on the roads (they brake for you), boats.
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
| 3D objects / characters | NVIDIA TRELLIS → SAM 3D → Tripo → Meshy (engine "auto") |
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

## 7. Next

1. One feeling picker on Voice & audio (tone + dialogue feeling), the editor's 3D tab → hand-over to the 3D World.
2. In the World: open doors, sit, drive a car, carry things between saved worlds; a short "what happened" film from the tour.
3. Template covers made from real results (one look per template family) and the remaining icon pass.
4. Picture → world: more model types (the closest one is used today), and "keep this object" to turn any photo object into its
   own AI 3D model in one tap.
5. Keep `docs/UI_MAP.md` up to date (`python3 tools/uimap.py`) and keep every new button inside the rules of §1.
