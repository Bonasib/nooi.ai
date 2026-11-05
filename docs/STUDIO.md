# nooi Studio Editor — setup, running and building (Phase 1, v219–v220)

> **بالعربية باختصار:** nooi Studio هو محرر الفيديو الجديد (خط زمني، طبقات، نصوص بكل اللغات، انتقالات، مؤثرات، ألوان، صوت).
> يعمل على الموقع في ‎/studio/‎، وكبرنامج للحاسوب (Windows / macOS / Linux) مع FFmpeg داخله، وكتطبيق للهاتف (Android / iOS).
> التصدير على الجهاز لا يرفع شيئاً ولا يستهلك نقاطاً. «خادم nooi» يصنع الفيديوهات الطويلة أو 4K على الـ VPS عبر Docker:
> شغّل `bash /opt/nooi/deploy/render.sh` مرة واحدة بعد التحديث. لا توجد مفاتيح API في هذا الجزء — الذكاء الاصطناعي يبقى على الموقع.

## What is where

```
studio/                         pnpm workspace (pnpm 10.28, Node 22)
  packages/editor-core          the project model (JSON), every edit as a command with undo, timeline operations, keyframes,
                                snapping, presets, the effect/transition catalogue, and compile() → the FFmpeg command
  packages/ui                   tokens.css, the icon set, Btn / Seg / Slider (the nooi look)
  apps/web                      React 19 + Vite: the editor. Built into ../public/studio (committed — the VPS needs no build)
  apps/desktop                  Tauri 2: the same editor in a window, FFmpeg inside (sidecar) for exports on the computer
  apps/mobile                   Capacitor 8: the same editor as an Android / iOS app (save + share through the phone)
  services/render-api           Fastify 5: resumable uploads (tus), server renders with FFmpeg through a queue (BullMQ on
                                Redis), live status (SSE + WebSocket), PostgreSQL through Prisma, ClamAV, 7-day cleanup
  infra/                        docker-compose.yml + .env.example for the render service on the VPS
```

How the parts talk:

- The site (`server.js`) serves the editor at `/studio/` and passes `/render-api/*` to the render service
  (`RENDER_API_URL`, set by `deploy/render.sh`). Same origin, same sign-in: the render service asks the site who the user is
  (`/v1/me`, `/v1/billing`), so it holds no accounts and no keys.
- Projects are saved in the account by the site's project store (`/v1/projects`, kind `studio`). AI work (Extend, Merge,
  Regenerate) goes through the site's jobs (`/v1/jobs`): the price is shown first, credits are taken only on success.
- Export, three places:
  1. **This device** (all three apps): WebCodecs through mediabunny, own GIF/WAV/MP3. Nothing uploaded, no credits.
  2. **nooi server**: the files that are only on the device go up (tus, resumes after a drop), titles are sent as
     pictures (correct shaping for every script), FFmpeg renders, the link is kept 7 days. No credits. Each plan has a
     number of renders at once, and higher plans go first in the queue.
  3. **This computer (FFmpeg)** (desktop app only): the same FFmpeg command as the server, run by the bundled FFmpeg.

Keys: there are none in the studio or the render service. The site's AI keys stay in the site's `.env` / Admin. The render
service's only secret is its database password, which `deploy/render.sh` generates and never prints.

## 0. Install only the editor (hPanel → VPS → Browser terminal)

For a site that runs nooi.ai v216 (the version before the new editor), this changes the editor and nothing else. Data, media,
`.env`, packages, settings and the other pages all stay as they are. Paste as root:

```bash
curl -fsSL https://raw.githubusercontent.com/Bonasib/nooi.ai/claude/festive-brahmagupta-08tfzr/deploy/editor-update.sh | bash
```

or upload `nooi-editor-update.zip` (built with `bash deploy/editor-package.sh`) to `/root` and run
`bash editor-update.sh /root/nooi-editor-update.zip`.

What it does:
1. Checks that every file it replaces is still exactly the v216 version (or this update). If one was changed, it stops
   without touching anything.
2. Backs up to `/var/backups/nooi/editor-<time>.tgz`.
3. Copies only the editor's files: `public/studio/`, `studio/`, `lib/studio219.js` and the small hooks in `server.js`,
   `public/index.html`, `lib/static124.js`, `lib/projects139.js`, `lib/collab196.js` and `lib/edit148.js`.
4. Restarts the site (a few seconds) and checks the home page, the API and `/studio/`. If any check fails, it puts
   everything back by itself.

Undo: `bash /opt/nooi/deploy/editor-update.sh --rollback`. After it: `/studio/` is the new editor, and the site's Edit
buttons open it (`?classic=1` keeps the old one for a while).

Which arrangement each screen gets:

| Screen | Arrangement |
|---|---|
| computers and tablets (the same panels, features and look) | rail · library · preview · clip settings over the timeline; a tablet held upright stacks the same four panels: the preview across the top, library and clip settings side by side, the timeline below |
| phones held sideways (screens under 600 px high) | rail · full-width preview over the timeline; the library and the clip settings slide in as drawers |
| phones held upright | preview / timeline / tool bar; a tool or the clip settings sit between a smaller preview and the timeline |

## 1. VPS setup (Hostinger, Docker Compose)

The site keeps running as before (systemd service `nooi`, `/opt/nooi`). The render service runs beside it in Docker.

1. Update the site to this version as usual (the deploy commands at the end of every report). The editor at
   `https://<your site>/studio/` works straight away; exports on the device need nothing else.
2. Turn on server exports, once, as root:
   ```bash
   bash /opt/nooi/deploy/render.sh
   ```
   It installs Docker if missing and writes `/opt/nooi-render/.env` (a random database password; renders at once by CPU
   count). It then builds and starts PostgreSQL, Redis, the API and a render worker, and adds
   `RENDER_API_URL=http://127.0.0.1:8790` to `/opt/nooi/.env`. Finally it restarts nooi and checks `/render-api/health`
   through the site. The first build takes a few minutes.
3. Optional virus scan of every upload (ClamAV needs about 1.5 GB of memory — a KVM 2 plan or bigger):
   ```bash
   bash /opt/nooi/deploy/render.sh --scan
   ```
4. Check: `bash /opt/nooi/deploy/doctor.sh` now has a "Studio render service" section. Logs:
   `docker compose -p nooi-render logs -f render-worker`.
5. Settings (`/opt/nooi-render/.env`, then run `render.sh` again):

   | Setting | Default | What it does |
   |---|---|---|
   | `RENDER_CONCURRENCY` | 1 (2 on 8+ vCPU) | renders at the same time |
   | `RENDER_KEEP_DAYS` | 7 | finished renders are deleted after this |
   | `RENDER_MAX_SECONDS` | 1800 | the longest timeline the server renders |
   | `MAX_UPLOAD_MB` | 4096 | the biggest single upload |
   | `UPLOAD_KEEP_DAYS` | 0 | uploads are kept (0) or deleted after N days |
   | `RENDER_PLAN_LIMITS` | free 1 · creator 1 · pro 2 · studio 3 · staff 4 | renders waiting or running per account |
   | `RENDER_PLAN_PRIORITY` | studio/staff 1 · pro 3 · creator 5 · free 8 | lower goes first |
   | `CLAMAV_HOST` | empty | `clamav` with `--scan` |

6. Turn it off: `bash /opt/nooi/deploy/render.sh --off`. The studio then offers exports on the device only.

Storage: everything is on the VPS disk for now: `/opt/nooi/media` is read-only for the containers, and the renders and
uploads live in `/opt/nooi-render/data`. Moving renders to Cloudflare R2 or Backblaze B2 later means one storage module in
`services/render-api` behind the same `/render-api/files/…` links.

Admin endpoints (owner and staff, through the site): `GET /render-api/admin/queue` (waiting, running, recent),
`GET /render-api/admin/usage?days=7` (renders and seconds per account) and `DELETE /render-api/admin/renders/<id>`.

## 2. Run it locally

Needs Node 22, pnpm 10 (`corepack enable`) and FFmpeg.

```bash
# the site (port 8080)
npm install && cp .env.example .env && npm run dev

# the editor with hot reload (http://localhost:5199/studio/ — /v1, /media and /render-api go to the site)
cd studio && pnpm install && pnpm dev:web

# the render service without Docker (memory store + in-process queue; port 8790), and tell the site where it is
pnpm --filter @nooi/render-api exec prisma generate
NOOI_APP_URL=http://127.0.0.1:8080 MEDIA_DIR=../../../media pnpm dev:api
#   …then add RENDER_API_URL=http://127.0.0.1:8790 to the site's .env and restart it

# the full set like the VPS (PostgreSQL, Redis, worker): from studio/
cp infra/.env.example .render.env   # set PG_PASSWORD, NOOI_APP_URL=http://host.docker.internal:8080
RENDER_ENV_FILE=$PWD/.render.env NOOI_MEDIA=$PWD/../media RENDER_DATA=$PWD/.data \
  docker compose -f infra/docker-compose.yml --env-file .render.env up -d --build

# checks
pnpm -r typecheck && pnpm -r test           # editor-core, web, render-api (render-api renders real files with FFmpeg)
pnpm --filter @nooi/studio-web build        # rebuild public/studio — commit it with the change
python3 ../tests/v219.py && python3 ../tests/v220.py
```

## 3. The desktop installer (Windows, macOS, Linux)

Built by GitHub Actions: **Actions → Studio → Run workflow** (or push a tag `studio-v0.1.0`). The run's artifacts are the
installers: `.msi` and `.exe` (Windows), `.dmg` (macOS, Apple silicon), `.deb`, `.rpm` and `.AppImage` (Linux).

On your own computer:

```bash
# once: Rust (https://rustup.rs) and the platform's needs — https://tauri.app/start/prerequisites/
#   Windows: Microsoft C++ Build Tools + WebView2 (already on Windows 11)
#   macOS: Xcode Command Line Tools (xcode-select --install)
#   Linux: sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
cd studio && pnpm install
pnpm --filter @nooi/studio-desktop dev     # a window with hot reload (the site must run on :8080)
pnpm --filter @nooi/studio-desktop build   # → apps/desktop/src-tauri/target/release/bundle/
```

`build` first downloads FFmpeg for the computer's platform (`apps/desktop/scripts/get-ffmpeg.mjs` → `src-tauri/binaries/`,
not committed) and then builds the editor with `--mode desktop`, which uses relative paths and talks to `https://nooi.ai`.
To point it at another site, use `VITE_SITE=https://your.site pnpm --filter @nooi/studio-desktop build`.

Signing: unsigned installers work but show a warning (Windows SmartScreen; on macOS right-click → Open). To sign, the owner
adds their certificates as repository secrets later (Apple Developer ID + notarisation; a Windows code-signing certificate).

## 4. The phone apps (Android, iOS)

Built by the same workflow: a debug **APK** to install on an Android phone, and an iOS **simulator** build.

On your own computer:

```bash
cd studio && pnpm install
pnpm --filter @nooi/studio-mobile android   # builds the editor (--mode mobile), adds/syncs the android/ project
pnpm --filter @nooi/studio-mobile open:android   # Android Studio → Run, or: cd apps/mobile/android && ./gradlew assembleDebug
# iOS (a Mac with Xcode 16+):
pnpm --filter @nooi/studio-mobile ios && pnpm --filter @nooi/studio-mobile open:ios   # Xcode → pick a team → Run
# the launcher icon and splash from apps/mobile/assets/icon-only.png:
cd apps/mobile && npx @capacitor/assets generate --iconBackgroundColor '#0b0c0f' --splashBackgroundColor '#0b0c0f'
```

Android needs Android Studio (SDK) and Java 21. iOS needs a Mac with Xcode. Store releases need the owner's Google Play and
Apple developer accounts, plus a signed release build (`./gradlew bundleRelease` with a keystore; Xcode → Archive).

## 5. Limits now (honest)

- **Sign-in inside the desktop and phone apps.** The site's origins `tauri://localhost`, `http://tauri.localhost`,
  `https://app.nooi.ai` and `capacitor://app.nooi.ai` are allowed by CORS (`APP_ORIGINS`). For the account to work inside
  the apps, add `tauri.localhost` and `app.nooi.ai` to Firebase → Authentication → Settings → Authorized domains. Until
  then the apps edit and export without an account (on the device, and FFmpeg on the computer).
- **What the server render approximates.** It renders cuts, layers, crop, flip, rotation, colour, LUTs, blur and other
  effects, fades, transitions as cross-fades, speed, reverse, freeze frames, ducking and the text fades. Animated keyframes
  are taken at the clip's start, and text motions other than fade come out as fades. The device export draws all of them
  exactly.
- **Weather & light and the erase / blur boxes (v222)** are drawn by the editor's own engine: in the preview and in exports made on the device. The server render and the desktop app's FFmpeg export leave them out for now.
- **FFmpeg in the desktop app** is a GPL build: H.264 needs libx264. Its licence is shipped beside it
  (`FFMPEG-LICENSE.txt`).
- **Speed.** This sandbox has no GPU, so exporting on the device is slow here. Real phones and computers use their video
  encoder.
- **Phase 2** (AI in the editor: auto-captions with speech recognition, background removal, smart cut, voice tools) and
  **Phase 3** (teams, templates, marketplace) are next, per the plan.

## The studio's frame (v223 — Step 1 of the owner's spec, see `docs/STUDIO_PLAN.md`)

- **Look:** "Nooi Obsidian". Dark panels, an Electric Cyan accent (`#00F0FF`), the AI gradient on AI tools, a red playhead, and the Inter and JetBrains Mono fonts. The tokens live in `studio/packages/ui/src/tokens.css`.
- **Header (40 px):**
  - logo;
  - **File** menu: new, open, project settings, save or open a `.nooi` file, ⌘K, Export;
  - Cloud: the saved state and Save now;
  - workspaces: Classic edit, Vertical short-form, Colorist, Audio;
  - **Nooi Mate**: a 340 px drawer that turns words into steps you approve, in English or Arabic, on the device, with no credits;
  - format, credits, theme, language, projects, Export.
- **Dock (8):** Media · Stock & AI (make with AI, AI tools) · Audio · Titles (text, captions) · Transitions · Effects (effects, filters & color, weather & light, erase & blur, motion) · Stickers (+ logo) · Templates (split screen 2–9, instant montage).
- **Timeline toolbar:**
  - undo / redo and the history list;
  - split, delete, ripple delete;
  - crop & reframe (fit / fill, Ken Burns);
  - the speed menu, color, the AI Hub (320 × 280);
  - keyframe ◆, voice-over with 3-2-1;
  - duplicate, freeze, detach, marker;
  - tools;
  - render status (plus a cache line over the ruler);
  - add a track, snap, zoom.
- **Clip settings:** Video (basic · effects · animation) · Color · Audio · Speed, plus Text for titles.

## The project engine (v224 — Step 2)

- **Magnetic main track:**
  - V1 is the spine. Clips on other tracks are attached to the V1 clip under them, and follow it through trims, ripples, splits, speed changes and moves.
  - Delete on V1 closes the gap.
  - The toolbar's link button turns it off or on.
- **Files** (File menu):
  - `.nooi`: the project in the spec's JSON shape;
  - `.nooipack`: the project and all its media in one ZIP, to move it to another device;
  - Open takes either, and the v223 `.nooi` too.
- **Site:** "Studio" is in the site header next to Explore, in the phone's top bar, and on the landing page.

## v225 — the owner's phone video, fixed; the classic motions and stickers

- **Moving clips on a phone:** a touch must rest still on the picture for half a second before it moves a clip, and the outline shows it is held. A quick swipe moves nothing. This fixes a clip pushed out of the frame by a resting finger.
- **The outline on the preview** is the clip's real picture: fitted, cropped, sized, moved and turned.
- **Out of the frame:** when a clip at the playhead is mostly outside the frame, the preview says so, with **Put it back**.
- **The clip settings** follow the playhead when it is moved by hand.
- **Saving to the account:**
  - the account copy leaves out the filmstrips and large thumbnails, which each device makes again;
  - a failed save shows why in the Cloud menu;
  - a dropped connection tries again by itself.
- **Scrolling bars:** the timeline toolbar and the phone's clip bar fade at their end edge, so it shows they scroll.
- **Motion** (Effects → Motion, and Clip → Video → Animation):
  - the 13 camera moves, and the classic editor's 20 animations;
  - each tile plays its example;
  - on a clip, an animation becomes keyframes.
- **Stickers** (Stickers → Stickers):
  - 10 banners, with their lines and colour set before adding;
  - 36 icon stickers (Material Symbols, Apache-2.0; licence in `studio/apps/web/src/media/MATERIAL-ICONS-LICENSE.txt`);
  - the studio's own drawings.

## v226 — smoother playback, the playhead pin, more motions, fonts and text effects, AI restyle and caption translation

- **Smoother playback:**
  - the preview is drawn at the size it is shown (at most twice the screen's density, never above 1280 px);
  - a video frame is sent to the GPU only when it is a new one (the browser's frame callbacks);
  - while playing, the time and the playhead move by themselves, without redrawing the editor.
- **The playhead's pin** (its head and line) can be grabbed and dragged to scrub. It is finger-size on touch screens.
- **The logo** is the green wave on its own, with no background.
- **Motion:** 60 animations (34 entrances, 12 exits at the clip's end, 14 loops), plus the 13 camera moves. Each tile plays its example.
- **Fonts by language:**
  - about 130 free Google Fonts in 7 writing systems: Arabic; English, Spanish and French; Russian; Japanese, Korean and Chinese; Hindi; Hebrew; Thai;
  - each tile shows the title's own words in that font;
  - a font is loaded only when its tile comes into view;
  - fonts that lack a weight now load too.
- **Text effects (24):**
  - gold, chrome, neon, fire, ice, 3D pop, comic, double outline, labels and more;
  - the engine gained gradient fills, 3D extrusion, glow and a second outline;
  - each tile is drawn by the same engine as the preview and the export.
- **Captions → Translate with AI:**
  - 20 languages, through the site's free text AI (`/v1/translate149`);
  - added as a second-language track, or replacing the words;
  - each line keeps its time.
- **Stock & AI → Restyle with AI:**
  - 56 styles, each with a drawn example;
  - the client chooses the model: nooi Auto, MiniMax H3, Kling 3.0, Kling 4.0, WAN 3.0 or Seedance 2.5 (names from the site's model list);
  - the clip's first frame is redrawn in the style by the picture AI, then the chosen video AI animates it with the scene's words;
  - the price of both steps shows first, and each step is charged only when it succeeds;
  - the result replaces the clip, or goes on a track above it.
- **AI tools → Extend:** "Merge into one clip" (on by default). The new part is joined to the clip by the site's free seamless merge. If the join fails, the new part goes right after the clip as before.

## v227 — nooi Motion: programmatic motion graphics (our own engine)

Built on our own code. No code from Remotion or any other motion library is used; only the idea of "video as a program" is shared.

- **Motion math** (`@nooi/editor-core` → `Motion`):
  - `interpolate` (clamp, extend or identity at the ends), `spring` (a damped spring with mass, stiffness, damping, overshoot clamping, delay, from/to, a set length) and `springLength`;
  - an easing set, colour parsing and `interpolateColors`, a seeded `random`, `noise2` / `noise3`;
  - shapes (rectangle, circle, ellipse, polygon, star, heart, triangle) with `toPath`, `pathLength`, `evolve` (draw a path in) and `pointAt`;
  - timing helpers `seq`, `loop`, `stagger`. Unit-tested.
- **37 motion graphics** in 9 groups. Titles → Motion graphics. Each tile is the template itself, drawn live; pointing at a tile plays it.
  - Lower thirds (6), kinetic titles (8), social (5), charts and numbers (5), shapes and backgrounds (5), callouts (3), timers (2), sound-reactive (2), Motion code (1).
  - A motion graphic is a title clip with `motion: { tpl, props }`. It is drawn frame by frame at the project's frame rate, so the preview, the tile and the export match.
  - Words are bilingual by default (English or Arabic, by the studio's language), and right-to-left text is drawn correctly.
- **The props form** (inspector → Motion graphic): words, colours, numbers (sliders), choices, on/off and data lists. Each change is one undo step; "Back to the template" restores the defaults.
- **Sound-reactive graphics** follow the edit's sound at each moment, from the waveforms of the clips playing then.
- **Motion code:**
  - write your own animation in JavaScript with `m` (frame, fps, t, dur, W, H, u, props, audio(), bars(n), ctx) and `M` (the motion math);
  - it runs in a worker inside a sealed frame (`sandbox="allow-scripts"`, its own empty origin, and a policy that blocks every network request); network, storage and the page are taken away;
  - errors are shown; a frame that takes over 2 seconds is stopped and the sandbox starts again;
  - the preview shows the newest picture, and the export waits for every frame.
- **Export:** motion graphics are drawn frame by frame in the device export. (v228 adds the server and desktop routes, below.)

## v228 — motion graphics in the server and desktop export

- The device draws each motion graphic frame by frame (the same program as the preview) into a video: the colour over black on top, the transparency as grey below. Any codec carries that.
- Server export: that video is uploaded (resumable) with the rest. The render service takes only the person's own uploads, and only for motion clips of that project.
- Desktop export (the app's FFmpeg): the video is written to the work folder.
- `compile()` (editor-core) takes `motions: { clipId: file }`. FFmpeg splits the two halves, joins them with `alphamerge`, then `unpremultiply`. The result is one see-through layer, placed like a title (position, size, turn, opacity) at the clip's time, starting inside it when the range begins later.
- The Export dialog keeps the server / this computer and says the graphics are drawn here first. The progress shows "Drawing the motion graphics".
- The render service runs in Docker: after the editor update, run `bash /opt/nooi/deploy/render.sh` once to rebuild it.

## v229 — 36 more motion graphics (73 in all)

- **Lower thirds (+4):** glass card, corner brackets, slanted bars, gradient strip.
- **Titles (+6):** letter wave, outline then fill, bouncy drop, rotating words, split reveal, cinematic title.
- **Social (+4):** story bars, poll, swipe up, notification.
- **Charts and numbers (+4):** horizontal bars, area chart, stat cards, versus.
- **Shapes and backgrounds (+4):** retro grid, floating particles, moving stripes, orbits.
- **Callouts (+3):** highlight box, spotlight, tooltip.
- **Timers (+2):** video progress bar (with chapter marks), date stamp.
- **Sound-reactive (+2):** sound wave, dot meter.
- **New group, Intros and outros (4):** logo reveal, end screen, light sweep, film countdown.
- **New group, Wipes and reveals (3):** colour wipe, circle reveal, bars sweep. These are full-frame; put one over the cut between two scenes.
- Each graphic has English and Arabic names and default words. Arabic text moves word by word, so its letters stay joined.
- The drawing helpers moved to `motion/kit.ts`; the second set is in `motion/templates2.ts`.

## v230 — 37 more motion graphics (110 in all)

- **Lower thirds (+3):** ribbon, box reveal, centred name.
- **Titles (+5):** stacked lines, blur in, scramble decode, flip in, flowing gradient text.
- **Social (+3):** star rating, chat messages (typing dots, then each bubble), live badge with viewers.
- **Charts and numbers (+4):** gauge, timeline, funnel, percent squares.
- **Shapes and backgrounds (+3):** aurora, dot grid wave, shape morph (circle → star → heart → hexagon → square → triangle, blended point by point).
- **Callouts (+2):** scribble underline, numbered step.
- **Timers (+2):** stopwatch, flip counter.
- **Sound-reactive (+2):** sound ring, block equaliser.
- **Intros and outros (+3):** curtain open, search bar, chapter card.
- **Wipes and reveals (+3):** diagonal slash, blinds, shape burst.
- **New group, Badges and offers (4):** sale burst, spinning badge, swinging price tag, corner ribbon.
- **New group, Frames and overlays (3):** camera viewfinder (REC, timecode), VHS tape, glowing border. These are full-frame and go over the picture.
- In `motion/templates3.ts`.

## v231 — the studio as part of the site, AI replace, and security

- **The site's sections along the top** (Home, Explore, Image, Video, Audio, Characters, 3D, Studio, Publish, Apps, Plans). Each opens that page of the site (`/?view=…`).
  - "Editor free in every plan" links to the plans.
  - On a phone, or on a screen under 820 px tall, the logo opens the same list as a menu, so the editor keeps its height.
- **Plans:** every plan card says "nooi Studio editor — included free", with a line under the cards. The timeline, effects, motion graphics, titles and device export cost nothing; only the AI tools use credits, and their price shows first.
- **Tablets** get the full editor. Checked: iPad upright 834×1194, sideways 1194×834, 768×1024 and 1024×768. Nothing overlaps and nothing is wider than the screen. On 768–900 px the long header labels give way.
- **Motion graphics, Enter and Exit:** none, fade, pop, slide up, slide down, slide from the side, zoom and bounce.
  - Each choice plays its example; the length is a slider.
  - They are drawn in the preview, the device export, and the video the server and desktop exports place.
  - Keyframes stay in the Video tab (◆).
- **The AI words:**
  - `#name` is one of the project's pictures, by the name it was uploaded with.
  - `@name` is a character: the site's Characters (same browser), or one added in the studio with a name, a photo, a look and a voice.
  - The names go to the job as reference pictures (`vRef1…`, `meta.refs130`). The server turns `#name` into that picture. A character's look and voice are written into the words.
  - A popover lists the matches as you type. Unknown names are marked.
- **Stock & AI → Replace person / voice** (the server's Replace-things engine, `scan136` + `replace136`):
  - the clip is looked at first: people, things, and what is said with its time;
  - a person, face or look → an @character (with its photo as reference) or words; a voice → another voice and, optionally, new words; or removed;
  - the price shows first; the result replaces the clip or goes on a track above it.
- **Stock & AI → Background:**
  - 12 drawn examples: forest, beach, desert, mountains, white studio, dark studio, market, city at night, office, café, space, snowy village;
  - or your own picture, or video (its first frame shows the place, and the new background is made to move gently like it), or words;
  - "Match the light" relights the people to the new place;
  - through the same engine, with the price first.
- **Security:**
  - `POST /v1/assets` added any address with any kind as a finished item of the account. It now takes only the person's own uploaded 3D file. This closes a way to pass an outside address to the AI tools as one's own video.
  - `/v1/uploads` answers 400 when no file is sent (it was a server error).
  - Uploads are limited per account: `UPLOAD_FILES_HOUR` (default 300 files an hour) and `UPLOAD_GB_DAY` (default 20 GB a day). Staff are not limited.
  - Reviewed and left as they are:
    - the AI tools take only files on this server's media folder (an outside address or a path out of it is refused);
    - media files are public by link, under random names (sharing and collaboration rely on that);
    - the Motion-code sandbox (v227);
    - the render service's per-person uploads (v228).
