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

## v232 — the owner's phone notes

- **Home went back to the editor.** When the site opened on a page that remembered the editor, it sent the person to the studio. It set its page to "home" first, but that save only happens 0.7 s later, so the redirect left first. The site kept "editor" as its page, and every visit to the home page bounced back to /studio/.
  - Now the page is saved at once before leaving for the studio.
  - Opening the site shows the site (a remembered "editor" page becomes Home), also when the account's cloud copy says "editor".
  - The studio's Home and logo go to `/?view=home`.
  - A studio opened with a video (`?job=`) takes that video; the classic editor's saved edit comes over on the next plain visit, so the video isn't added twice.
- **The site's sections on top on every computer and tablet**, also 1024×768 sideways and 1280×720 laptops. Only phones, and phones held sideways, use the menu.
- **A phone:** a Home icon, and beside it the menu of the site's sections. The menu opens over the page; the header clips what overflows it, so the list is pinned to the screen.
- **A finger on the timeline scrolls it.**
  - A swipe across a clip no longer picks it or moves it.
  - A quick tap picks the clip.
  - A press held still for 0.4 s (with a short vibration) lifts it to move or trim.
- **Dragging the playhead's pin** to the timeline's edge scrolls the timeline along, so the playhead and the time stay in view.

## v233 — Auto tools and the clip settings in sections

- **Auto** (a new rail item, between Stock and Audio): tools that edit by themselves. Each is one tap and one undo step. Each card plays a small example of what it does.
  - **Remove pauses:** cuts out the quiet stretches (over half a second) from the main track.
  - **Cut to the beat:** finds the music's beats and trims the main track's clips so every cut lands on a beat (clips only get shorter).
  - **Auto captions:** hears the words and places them as captions at their times. This is the only tool that uses the server (`/v1/captions169`): its price shows first, and it is charged only when it works.
  - **Auto reframe:** changes the frame (9:16, 1:1, 16:9 …) and fills every picture to it, keeping the middle.
  - **Auto colour:** balances each clip from its own middle frame (brightness, contrast, colour strength, colour cast).
  - **Even loudness:** brings every clip's sound to the same level, without clipping.
  - **Duck the music:** lowers the music under the voices.
  - **Soft cuts:** a soft dissolve at every cut of the main track.
  - **Auto-edit: do it all** runs pauses, loudness, colour, ducking and soft cuts in a row.
  - Everything except captions runs on the device, from the edit's own pictures and sound.
- **The clip's settings in sections**, as in the big editing apps. Each section has an icon and a title, opens or closes with a tap, and is remembered on the device:
  - Video: Position & size, Opacity & blend, Crop, Keyframes, Effects, Enter & exit.
  - Audio: Volume, Clean up. Speed. Colour: Basic, Light, HSL, Looks.
  - Text: Words, Font, Effects, Style, Animation.
- **A phone:** the bottom rail scrolls sideways, so every item fits (Auto included). On a computer the side rail scrolls when the window is short.

## v234 — moving backgrounds and separating a person

- **Separate the person** (the clip settings' new "Background & cut-out" section, and step 1 of Stock & AI → Background):
  - **Green screen key:** finds the screen's colour around the picture's edges by itself (any flat colour; a studio green or a strong chroma blue is keyed without asking). Controls: the colour (with "Find it"), strength, soft edge, and taking the screen's colour out of the edges.
    - The key measures colour as FFmpeg's `chromakey` does, so the preview, the device export and the server export agree. The despill matches FFmpeg's `despill`.
  - **Cut out the person** (no screen needed), on the device, free, with nothing uploaded.
    - It uses MediaPipe's selfie segmenter (Apache-2.0), served by our own server from `/studio/vendor/mediapipe-0.10.21/`: about 10 MB, downloaded the first time only.
    - A video becomes a cut-out asset (`alpha: "stacked"`): the picture on the top half and its mask (grey) below. The compositor reads both halves; FFmpeg splits them and joins them with `alphamerge`. The clip's sound stays on the original, detached.
    - A picture becomes a PNG with real transparency (`alpha: "own"`).
    - A blue sky or a coloured wall is not taken for a screen: picking a background first cuts the person out.
- **New background** (step 2), one undo step each:
  - **Moving:** 16 scenes drawn by nooi Motion, each tile playing — aurora, bokeh, clouds, ocean, studio light, stars, neon grid, rainy window, snowy night, sunset, particles, waves, embers, under water, city at night, forest light. They are also in the Motion gallery as the new group "Moving backgrounds".
  - **Pictures:** the 12 drawn places.
  - **Your own:** a video, repeated to cover the clip with its sound off, or a picture; it fills the frame.
  - **AI:** the v231 server change, price first.
  - **Match the light on the person:** shifts its warmth, brightness and tint toward the background's. The change is remembered, so another background replaces it rather than adding to it.
- **Where it goes:**
  - On V1, the background takes the clip's place, and the person moves up onto a track of its own, attached to it. The cut's transitions follow.
  - On another track, it goes on a new track just below.
  - Another pick replaces the background in the same place. "Remove the background" puts the person back on V1.
  - These are `putUnder` / `removeBackdrop` in editor-core (`key.ts`).
- **Server export:** a keyed clip, a cut-out, and a picture with transparency stay see-through through the colour filters. FFmpeg makes the mask on a copy of the picture and joins it back. This is tested with real FFmpeg in `test/v234.test.ts`. The render service needs `deploy/render.sh` to pick this up.

## v235 — the background library and backgrounds made with AI

- **Pictures:**
  - The owner's 20 background pictures are made Full HD: Lanczos scaling, light noise cleaning, sharpening, a touch of colour. They are served with the studio from `/studio/backdrops/`, with 320 px previews. The list is in `media/photos.ts`.
  - They are sorted in four groups: 8 studios, 5 technology, 4 nature & travel, 3 business & finance.
  - **Still or Moving:** moving adds a slow push-in (1 → 1.08) and the light that suits the picture — rain on the rainy lane and the news camera, stars on the telescopes and the circuit board, a warm light leak at sunset.
  - A picture used again comes from the project's library instead of being downloaded twice. The 12 simple drawings stay below.
- **Scenes:**
  - 11 new studio sets (`motion/templates5.ts`), all empty rooms with no chairs, tables or people: white cyclorama, slatted studio, neon room, hex tech wall, data streams, connected world, market wall, finance ticker, glass office, news studio, garden wall.
  - With the 16 scenes from v234 that makes 27, by group. Each can be moving, or still (speed 0 holds one picture). The Motion gallery now has 137 graphics.
- **No clip picked:** the background goes on the main track, after what is already there.
- **Make a background with AI:**
  - Pick a group (studio, technology, nature, business, finance) or write your own words.
  - Pick where the person will stand (centre, left, right), and whether it is a picture or a moving clip.
  - The price shows first. The words always say: no people, no chairs, no tables, no text, no logos.
  - A moving one is made from the picture: a slow push-in with gentle ambient motion.
  - The video's own background (v231) is still offered below it.

## v236 — the owner and admins aren't stopped for credits

- The server has always charged the team (role owner / admin) nothing. But the site's page and the studio checked the balance before sending, so an admin with 0 credits was told "Not enough credits".
- **The site:** `crFree()` is now also true for the owner and admins. It switches on only once `/v1/me` has said so.
- **The studio:** it reads the role from `/v1/me`. The team's AI buttons stay on, and the top bar shows "Team · free".
- A customer with no credits is still told and stopped. Tested in `tests/v236.py`.

## v237 — everything on MiniMax

- **The switch:** Admin → AI providers → MiniMax → **"Everything on MiniMax"**. Setting `MINIMAX_ALL=1` in the server's `.env` does the same.
- **What moves to MiniMax:** every job MiniMax can make goes to the owner's MiniMax balance, whatever model the customer picked:
  - videos from words or a picture (Hailuo);
  - pictures, including with a character's photo (Image-01);
  - voices (Speech) — a customer's chosen ElevenLabs voice stays as it is;
  - music;
  - the site's text AI (the Mate, the agents, analysis): MiniMax-M3 over MiniMax's Anthropic-compatible API (`/anthropic/v1/messages`). It falls back to another connected text AI if MiniMax fails.
- **What stays with its own engine:** Character Swap, Motion Control, lip-sync, jobs that read a video, picture edits, upscaling, 3D.
- Customers pay the same credits.
- The models can be changed in Admin → MiniMax → Models (optional), now including the text model; also `MINIMAX_TEXT_MODEL`.
- Tested in `tests/v237_minimax.mjs` against a mocked MiniMax (32 checks).

## v238 — Recast, and why jobs fail

- **Recast** (Stock & AI → Recast, our own design) changes a filmed video two ways:
  - **Keep the motion.** The movement, camera and timing stay as filmed, and everything performing it comes from your references (an @character, outfits, props, places, products, a look, plus words).
    - Per version, a new first frame is made from the original frame and up to 3 reference pictures. Picture 1 is the frame; the references are pictures 2–4.
    - Then Motion Control carries the whole take's motion onto it (`mc26`; "Keep the original place" → `mc30`, which keeps the video's background).
  - **Swap elements.** Each line says what changes and what it becomes, optionally with a reference picture or an @character: a person, a product, the text. They all go in one Replace-things job, which remakes only the seconds where they're seen.
  - **Versions:** 1–4 from one setup (each its own job, `meta.v238`), and **More like this** on a result for two more.
  - **Compare:** the original and the new version play in sync, with a handle to drag (or a slider).
  - **Use it** (replace the clip) or **Add above**.
  - The price shows first; credits are taken only when it works.
  - It needs the AI engine: MiniMax's own API doesn't change an existing video.
- **`deploy/why.sh`** (read-only, no keys): whether the AI engine and MiniMax are connected, whether everything is on MiniMax, and the last failed jobs — what was asked, where it went, why it failed, and whether MiniMax could have made it.

## v239 — Replace faces (several people in one video)

- **The analysis finds every face.** `lib/scan136.js` now asks the analysis agents for each person's face box (and to list two different people as two items). Each person gets a square 192 px face picture (`item.face`, `faceBox`).
  - Without a face box, the face is guessed from the top of the person's box (`faceGuess`).
  - A list made before v239 gets its faces from the frames already on the server, without asking the agents again.
- **A new face for any of them, several at once.** On the site, the Replace things sheet opens with a **Faces** row. Under each face: **New face** (a photo) or **@ Character** (one with a face picture), and **Keep**.
  - All the faces picked go into one Replace-things job, made in one pass over the seconds they're seen in. The price shows first; nothing is charged if it fails.
  - Up to 6 new faces in a video and 3 in a picture; the server says so with a 400.
  - The change is face only (`changes[].face: true`): the person keeps their hair, body and clothes, and every movement, expression and lip movement.
- **Motion Control → Replace the person, step 3** has **Several people? Replace their faces**. It sends that video to the analysis (once) and opens the same Faces sheet.
- **The studio:** Stock & AI → Replace person / voice shows the same faces (photo or @character for each) and makes them in one go.
- **Why MiniMax didn't take over** (owner and admins only). When the AI engine refuses a job for its balance and MiniMax doesn't step in, the reason goes on the card's staff line and in `deploy/why.sh`. It is one of:
  - no MiniMax key;
  - the switch is off;
  - a job MiniMax can't make: a Character Swap, Motion Control, lip-sync, Replace things / Replace faces, or anything that starts from a video. These need the AI engine's balance.

## v240 — Only my MiniMax key

- **The switch:** Admin → AI providers → MiniMax → **Only my MiniMax key**, or `MINIMAX_ONLY=1` on the server. It needs a saved MiniMax key.
- **While it's on, the AI engine is never used**, even with its key saved. The site treats the engine as not connected; the key stays saved for later.
- **Everything MiniMax can make goes to your MiniMax balance**, whatever model was picked: videos from words or a picture (Hailuo), pictures, voices, music and the site's text AI. This is the same routing as "Everything on MiniMax".
- **What MiniMax can't make is refused before anything is charged:** Character Swap, Motion Control, Replace things / Replace faces in a video, lip-sync, picture edits, upscaling and sound effects.
  - On the site, Motion Control shows "This tool isn't available right now — nothing is charged" and Make can't be pressed. Replace things doesn't open, and its buttons are hidden.
  - In the studio, Replace, Recast and Restyle say the same. Make with AI keeps working (on MiniMax).
  - Staff are also told which switch is doing it.
- **`deploy/why.sh`** shows "AI engine: OFF (key saved, not used)" and "Only my MiniMax key: yes".

## v241 — Seedance on your own ByteDance key (BytePlus ModelArk)

- **Where the key goes:** Admin → AI providers → **Seedance (ByteDance)**, or `SEEDANCE_API_KEY`. The connection follows BytePlus's API reference: `POST {base}/contents/generations/tasks`, then `GET …/tasks/{id}`.
- **Your key comes first** (before the AI engine and before MiniMax) for:
  - every Seedance model picked: 2.0 Fast, 2.0, 2.5 and 2.0 Mini;
  - editing a video's seconds: Edit with words, Replace things / Replace faces, Extend;
  - "Auto" videos, unless MiniMax takes every video.
  - With "Only my MiniMax key" on, Seedance picks and Replace things in a video still run on ByteDance, because it's your own key.
  - Character Swap, Motion Control, lip-sync and pictures never go to ByteDance.
- **Models:** `dreamina-seedance-2-0-fast-260128`, `dreamina-seedance-2-0-260128`, `dreamina-seedance-2-5-260628` and `dreamina-seedance-2-0-mini-260615`.
  - Admin → Models (a model's API id) wins.
  - A Seedance 2.x id on the Seedance card is used for plain Seedance. An old 1.0 id there is ignored.
- **The request:** the site builds the same words and references as for Seedance on the AI engine, then sends them in BytePlus's form:
  - text;
  - `first_frame` / `last_frame`, or `reference_image` (@Image1…), `reference_video` (@Video1) and `reference_audio`;
  - `ratio`, `duration` (4–15 s; up to 30 s on 2.5; a 2.5 edit keeps the video's own length), `resolution` per model (Fast and Mini go up to 720p), `generate_audio`, and `watermark: false`.
- **Files:** pictures on the server go as Base64, so ByteDance doesn't need to reach the server for them. Videos and sounds go as a public link (`PUBLIC_BASE_URL`), the only form BytePlus takes.
- **Results:** the finished video is saved on the server (ByteDance's links last 24 hours). A failed task is refunded, and no other engine is tried.
- **Real faces:** BytePlus says Seedance 2.0 / 2.5 refuse reference pictures or videos with real human faces. The exceptions are Seedance's own outputs from the last 30 days, its digital characters and authorised portraits. Such a job is refused; the customer is told why (EN + AR) and nothing is charged.
- **Before using 2.0 / 2.5:** BytePlus requires the models to be activated (a balance above USD 30, a Savings Plan or a Seedance resource pack).
- **`deploy/why.sh`** says whether the ByteDance key is connected.
- **v241b — saved keys stay visible.**
  - With "Only my MiniMax key" on, Admin → AI providers used to show the AI engine as "Not set", as if its key had been deleted. The key was always kept.
  - Now it shows "Key saved — paused (Only my MiniMax key is on)", with how to use it again.
  - `deploy/why.sh` lists every key saved in Admin (yes/no, never the key). It warns about any saved key the server can't read; that happens when `SECRET_KEY` in `.env` changed after the key was saved.

## v242 — The start page, the Mini Crew, Infographics, Extend with AI

- **The start page** (visitors) follows the owner's design.
  - The hero: "Your Creative Team, Always on Call", with the crew.
  - "Meet Your Creative Team": a card per agent, swiped on a phone, with arrows on a computer, and dots underneath.
  - The four benefits, and "Made with nooi".
  - Then the plans, the questions and the footer, as before.
  - On a phone, a bar at the bottom: Home · Projects · start · Team · Me.
  - It's light like the design. Once someone signs in, the site's dark look comes back, unless they switched the theme themselves on the start page.
- **The nine agents are the owner's Mini Crew** (`public/crew/*.webp`, cut from the owner's sheet): Quill writes, Nova designs, Max directs, Lumi films, Lyra voices, Echo makes the sound, Remy edits, Duke produces and Iris checks.
  - `botSVG` draws each agent's picture everywhere agents appear; a working agent moves.
- **Infographics** (Titles → Motion graphics → Infographics, 12): checklist, steps, cycle, pyramid, comparison table, KPI board, icon row, quote, call to action, news ticker, route and people chart.
  - These are the classic editor's infographics redrawn for nooi Motion. They work in any language (Arabic right to left), and the preview matches the export.
- **Extend with AI** (Stock & AI → Extend, or the clip's settings → Extend with AI).
  - The frame where the picked clip ends starts a new shot that continues it. Because it uses the clip's own end, a trimmed clip continues from where it was cut.
  - Length +3 to +10 s, the video model, and what happens next (optional). The price shows first.
  - The new shot lands right after the clip, and the clips after it move along.

## v243 — Smart cut by the words, follow the person, check before posting, beat cuts on a grid

Ideas taken from the open-source video-editing-skill project (MIT), rewritten in our own code. The core is plain functions in `packages/editor-core/src/cutting.ts`, tested in `test/v243.test.ts`; the panels are in `apps/web/src/ui/Smart.tsx`.

- **Smart cut by the words** (Auto → first card).
  - The edit's sound is heard once on the server, the same way Auto captions is (`/v1/captions169`). The price shows first.
  - It lists what it would take out, for a look first:
    - long pauses (over 0.6 s, with 0.15 s of air kept on each side);
    - filler sounds: um, uh, er, hmm, امم, آه, إيه;
    - leaned-on words, only when asked: like, basically, you know, يعني, طيب, بصراحة, أصلاً…;
    - retakes: the same first three words, or the first eight words over 72% alike, said again within the next four phrases. The earlier take goes.
  - Arabic spellings are folded (أ/إ/آ → ا, ة → ه, ى → ي, no tashkeel, stretched letters shortened) so they match however they were written.
  - Each line can be unticked; a tap on its time plays from there.
  - One tap cuts them all in one undo step. A cut never falls inside a word that stays.
  - The music keeps playing: a music bed that crosses a cut isn't split, a bed after it moves up, and the bed is trimmed to the new end.
  - The words are kept while the edit is open (moved to their new times after a cut), so Cut to the beat can avoid them.
- **Cut to the beat on a grid**: every beat, every bar (every fourth beat, starting on the strongest of the first four) or the 8ths. A cut never lands inside a word that was heard; it moves to the beat before.
- **Auto reframe follows the person** (the default; "Keep the middle" is still there).
  - The person is found on this device with MediaPipe's selfie segmenter. A wide picture is looked at in three overlapping squares, which finds a small, far person far better.
  - Their centre is sampled every 0.25 s (at most 80 times a clip), gaps are filled, a median of five steadies it, and a dead zone ignores small moves.
  - The result is eased x keyframes on the clip, never a jitter, and never past the picture's edges.
- **Check before posting** (Auto, and a short version in the Export dialog for the chosen platform). For TikTok, Reels, Shorts, YouTube, X, LinkedIn, Facebook, podcast and TV (EBU R128) it checks:
  - the shape, the length limits and the frame rate;
  - titles under the platform's buttons and caption (the safe area). "Show the safe area" draws it on the preview;
  - the loudness, measured with ITU-R BS.1770 (K-weighting, 400 ms blocks, gated) and the peak. The target is −14 LUFS for the social platforms, −16 for podcasts and −23 for TV.
  - Each problem has its fix: change the shape, move the title in, or make it the platform's loudness. The loudness fix never lets the peak go over −1 dB, and a clip's volume goes no higher than 2× (the toast says when that limits it).

## v244 — 3D graphics, hand-drawn looks, Emoji pop, Text punch, speed ramps, group icons

- **3D** (Titles → Motion graphics → 3D, 8): an extruded 3D title, a spinning coin logo, a product box (its label on the faces), a phone mockup (its screen made from the words), flying particles, a camera fly-through of panels, a 3D bar chart and a globe with routes.
  - They are drawn by a small 3D renderer of our own on the same 2D canvas (`motion/templates7.ts`): perspective, flat shading from one light, back faces hidden, far faces drawn first, and words mapped onto faces. No WebGL is needed, so the preview, the tile and the export are the same picture.
- **Hand-drawn** (7): cut paper, crosshatch ink, a risograph print, a sketchbook, a math explainer, isometric line art and pixel art.
  - These are print and animation looks, drawn in our own code. The idea of a set of looks came from the MIT-licensed animate kit in video-editing-skill; none of its code is used.
  - They move "on twos" (12 drawings a second) like hand animation, and their lines boil. All randomness is from fixed seeds, so a frame always draws the same.
  - Pixel art is drawn at one sixth of the size and enlarged without smoothing.
- **Emoji pop** (Social) and **Text punch** (Titles). These were the two missing from the 18 flat graphics in video-editing-skill's list; the other 16 were already in nooi Motion:

  | Their graphic | nooi Motion |
  |---|---|
  | lower third | Lower thirds (13) |
  | title card | Cinematic title |
  | kinetic text | Words spring up |
  | callout | Callouts |
  | counter | Number counter |
  | list reveal | Checklist |
  | quote card | Quote |
  | progress bar | Video progress bar |
  | subscribe | Subscribe button |
  | logo sting | Logo reveal |
  | chapter title | Chapter card |
  | bar chart | Bar chart |
  | highlight box | Highlight box |
  | shape wipe | Shape burst |
  | notification | Notification |
  | countdown | Countdown |
- **An icon on every group** of motion graphics, both on the chips and on the group titles.
- **Speed ramps** (the clip's Speed tab → Speed ramps, 8): Hero moment, Bullet time, Montage, Jump cut, Flash in, Flash out, Smooth rise and Slow finish.
  - Each tile shows its curve (higher means faster) and a dot that moves at its speeds.
  - A ramp cuts the clip into ten equal parts of its source, each at the curve's speed (`editor-core/src/ramps.ts`). The preview, the device export and FFmpeg all play it with no new engine.
  - The clips after it move along. It's one undo step.

## v245 — For another editor, music made in code, long video → shorts, the lossless server cut

- **For another editor** (Export → For another editor). The edit goes out as a small text file, with the media referred to by file name (keep the files next to it). The code is in `editor-core/src/nle.ts`:
  - **FCPXML 1.10** for Final Cut Pro, DaVinci Resolve and Premiere: the main track is the spine (with gaps), the other tracks are connected clips (lanes), speed is a time map, and volume and markers are included.
  - **EDL (CMX3600)** for any editor: the main track's shots with source and record timecodes, M2 lines for speed, the clip names and the markers.
  - **MLT** for Shotcut and Kdenlive: a playlist for each track that has clips, with blanks for gaps and speed through timewarp.
- **Music made here** (Audio → Music made here): eight moods — Calm, Upbeat, Epic, Lo-fi, Corporate, Tension, Happy and Cinematic.
  - Each mood has an icon and a little equaliser moving at its tempo. You choose a length of 15, 30 or 60 s; Listen plays it, and Add puts it on the timeline.
  - A mood sets the tempo, key, chords, drum pattern, bass pattern, how busy the tune is and the swing.
  - The score is written from a seed (`editor-core/src/music.ts`): the first bar is an intro, the tune walks the scale and lands on the chord, and the end fades. The same seed always gives the same music; Another tune changes the seed.
  - The browser plays it with its own synthesizers (`media/synth.ts`): a pad, bass, lead, pluck, kick, snare and hi-hat, made from oscillators and noise and mixed offline.
  - Add places a WAV at the playhead and marks its beats. It's free, nothing is downloaded and there's no licence to worry about.
- **Long video → shorts** (Auto). It uses the same words as Smart cut, heard once.
  - A moment is 20–60 s of whole phrases. It scores for:
    - a hook in its first words (a question, a number, "how", "why", "the secret", لماذا, كيف, سر…);
    - ending on a full sentence;
    - steady talk;
    - few long pauses and fillers;
    - being close to 35 s.
  - The best moments that don't overlap are listed (the weak ones are left out), each with why it was picked.
  - "Make this short" saves the long edit as it is and opens a copy cut to that moment. The copy is 9:16 and follows the person, with captions from its words (a few words a line, never leaving one or two words of a sentence alone).
- **The lossless server cut** (`lib/smartcut245.js`, used by `trim135` when a customer's video is trimmed before merging).
  - For H.264, only the frames from the cut to the next keyframe are made again, matched to the source's profile, pixel format and frame rate. Everything after the keyframe is copied: the picture data is the source's, byte for byte. The sound is cut exactly.
  - Anything else (VP9, variable frame rate, no keyframe in the range) is re-encoded as before.
  - Tested in `tests/v245_smartcut.mjs`: exact length, no decode errors, the copied packets the same, and the first frame the source's.

## v246 — from the owner's why.sh: the engine's balance read again, Character Swap on the ByteDance key

- **Why videos were failing:** the AI engine's account is out of credits. Character Swaps went only to it, so they all failed. Customers were refunded.
- **The balance check had a bug.** It built its address from the saved base URL as it was. A saved base like `https://api.kie.ai/api/v1` (or `kie.ai`) gave a doubled path and a 404, so the site never saw a top-up by itself. It now uses the same cleaned address the jobs use (`kieBase`). After a top-up, the "out of credits" mark clears at the 15-minute check, or at once with Admin → Models → Connections & live status → Test.
- **Character Swap now goes to the owner's ByteDance key first** while the swap engine is Seedance (the default). The video and the new person go as BytePlus references, and it's charged once on success.
  - BytePlus turns down a real person's face. Then the same swap goes to the AI engine, once.
  - If the engine is off (Only my MiniMax key) or known to be out of credits, the customer gets ByteDance's reason instead of "the engine can't take work", and nothing is charged.
- Motion Control (Kling) and lip-sync still need the AI engine.
- `deploy/why.sh` says this on a failed swap. Tests: `tests/v246.py`, and `tests/v241_bytedance.mjs` (updated).

## v247 — Seedance takes over every engine error; the reference-video scenes in the studio; formal stickers

- **Seedance takes over every time the AI engine gives an error** (`bdBackup247`, ahead of the MiniMax backup).
  - A video the engine couldn't make (out of credits, a refused key, busy, its own failure) goes to Seedance on the owner's ByteDance key, once.
  - That covers text or picture to video, references, a part of a long video, editing a video's seconds and a Character Swap on any swap engine.
  - It doesn't cover what Seedance can't do: Kling Motion Control, lip-sync, talking avatars, upscaling, 3D and pictures.
  - The owner is still told when the engine is out of credits. The customer is charged once, on success.
- **Video scenes** (Titles → Motion graphics → Video scenes, 28). These are the classic editor's v206 scenes, made after the owner's reference videos:
  - the 20 named effects: Orbit, Chat Takeover, Frame Escape, Snap Zoom, Checklist Pop, Headline Storm, Zoom Portal, Growth Curve, Studio Reveal, B-roll Overlay, Paper Cutout, Dolly Zoom, Magazine Cover, Liquid Glass, Zoom Through Cut, Green Screen, Frame Break, Digital Zoom, Phone Mockup and Checklist;
  - the showcases: Totem Wall, Spread Rows, Iso Cascade, Wheel Carousel and Cascade Deck;
  - the reference motions: Kinetic promo, Vlog kit and App burst.
  - The drawing is the classic editor's own code (`motion/scenes206.js`) with the helpers it uses, so they look the same. Each keeps its words, list, number and colour, on its glowing background or over the video.
  - **Picture slots:** a new field type, `pics`. You tap your pictures from Media; they're numbered in order and repeat across the slots when there are fewer of them.
  - Pictures are loaded once (`motion/pics.ts`). The preview redraws when they arrive, and the device, server and desktop exports wait for them first.
- **Formal stickers** (Stickers → Formal, 24): gold and quality seals; APPROVED, OFFICIAL, CONFIDENTIAL, DRAFT, PAID and URGENT stamps; Verified; Certified and Official Partner ribbons; Breaking news; a laurel award, a medal and a trophy; a secure shield; Information and Notice signs; quote marks; a gold divider and gold corners; a signature line; Coming soon; Limited offer.
  - They use navy, gold, burgundy and green. The ones with words have an Arabic drawing too, which shows and is added when the editor is in Arabic.
- Tests: `tests/v247.py` (the server) and `tests/v247_studio.py`.

## v248 — "Seedance (ByteDance): no task id"

- **What happened:** the owner's key was saved and Admin showed it as Connected, but a video from a prompt failed with "no task id". The site only accepted the exact answer `{ id }` to a new task. Any other answer had nothing to go on, and nobody could see what had actually come back.
- **What changed** (`providers/bytedance241.js`):
  - The Base URL is cleaned up (`bdBase248`). An empty field, a console or docs page, an `ark…` host without `/api/v3`, or a pasted full `/contents/generations/tasks` address all become the API's address. Another provider's address is kept as it is. The Test in Admin uses the same address.
  - The task id is read from `{id}`, `{task_id}`, `{data:{id}}`, `{data:{task_id}}` or `{data:"…"}`. The task's state is read from `{status}` or `{data:{status}}` in any case (succeeded / SUCCESS / completed…), and the video from `content.video_url` or the other usual places.
  - A web page that comes back with "OK" says the Base URL is wrong. An error inside an "OK" answer gives its own words (for example "has not activated the model", or "insufficient balance"). A reply that carries a task's state is still read as a task, even a failed one. An answer with nothing usable shows what it said (keys hidden). The real reason shows on the failed job and in `deploy/why.sh`.
  - A key's name typed in the Model id field (`apikey-…`) is ignored. Only a Seedance model id is used there.
- Tests: `tests/v248_bd.mjs` (every answer shape and Base URL against a stand-in fetch), plus `v241`, `v246` and `v247`.

## v249 — where the Admin settings live, and clearing a saved value

- **The owner asked:** "anything written in the dashboard doesn't show on the VPS".
  - Admin → AI providers saves on the server at once, encrypted, in `data/db.json`. That's not the `.env` file, so it doesn't appear there.
  - These values win over `.env`, and they're used at once, with no restart.
- **A saved value can now be cleared:** type `-` in its field and save. Before, an empty field left the saved value as it was, so a wrong value (such as an API key's name in Seedance's Model id) could never be taken out. Each provider card says so under its fields once a key is saved.
- **`deploy/why.sh` → "what the server uses right now"** shows, for ByteDance (Seedance), the AI engine and MiniMax:
  - whether there's a key (never the key);
  - the model id, and whether a Seedance Model id is ignored because it's not a model id;
  - the address as the server cleans it;
  - where each one comes from: Admin or `.env`.
- Tests: `tests/v249.py`; `tests/v184.py` still passes.

## v250 — "Your account has not activated the model dreamina-seedance-2-0-260128"

- **The real reason, shown by v248:** BytePlus switches on each Seedance model separately, for each account (BytePlus console → ModelArk → model activation). It asks for a balance above USD 30, a Savings Plan or a Seedance resource pack. The owner's key works, but Seedance 2.0 isn't switched on for it.
- **What the site does now:**
  - A model BytePlus calls "not activated" is remembered for 6 hours. It's forgotten sooner on the Seedance card's Test in Admin, or when a video is made on that model.
  - The job goes to the nearest Seedance model the account *has* switched on. For example 2.0 → 2.0 Fast → 2.5 → Mini, each tried once. If that model is cheaper, the customer pays its lower price.
  - With none switched on, the AI engine makes it, if it can take work. Otherwise the customer is told plainly ("Seedance isn't switched on for this site yet — nothing was charged").
  - Admin's Seedance card shows which model isn't activated. `deploy/why.sh` says which model and how to activate it.
- Tests: `tests/v250.py`, plus `v241`, `v246`, `v247`, `v248` and `v249`.

## v251 — sound on MiniMax videos, picture names, tap to view, one header, Seedance waiting

- **No sound on MiniMax videos:** MiniMax's video models (Hailuo) make silent videos; they have no sound track at all. With "Everything on MiniMax" on, a video that asks for sound now goes to Seedance (it makes sound with the video), on the owner's ByteDance key first. Silent videos stay on MiniMax.
- **Picture names in the prompt:** a picture added to the prompt box is tagged with its file name (`#elias` for `elias.png`). Two with the same name get `elias2`. Camera or screenshot names (`IMG_1234`, `Screenshot…`) still get `#image1`.
- **Tap to view:** a finished picture or video in the results has a full-screen button, and tapping a picture opens it. Both open the viewer, which has Download.
- **Waiting:** a job that isn't finished shows its stage and how long it has run (m:ss). For Seedance it adds a note that it usually takes 2–8 minutes, and longer for long videos, which are made in parts.
- **One header:** the editor wears the site's own header: the logo (to Home), the site's sections, theme, search, credits (to Plans), language, Library and the account. Below 1180 px wide the sections sit behind the menu button, so nothing overlaps on tablets or phones. The editor's own bar (file, undo, export…) sits under it.
- Tests: `tests/v251.py`, `tests/v251_route.mjs`. `v231`, `v232` and `v236` were updated to the new header. `v246` now checks the balance note (not the whole reply, where a time stamp can hold "404").

## v252 — "The provider couldn't process this request" on Seedance 2.0 (why.sh)

- **What was wrong:** the screen showed only the short customer line, never what ByteDance said. ByteDance's own reasons (a real person's face, for example) were also lost on the way to the customer (`lib/errors.js classify` dropped them), so the customer saw the generic line.
- **Now:**
  - ByteDance's own words reach the customer when we have them (for example, its real-face message).
  - A video ByteDance turns down for any other reason goes to the owner's MiniMax key once, when MiniMax can make it (from words or a picture). MiniMax's videos are silent. The customer is charged only once it's made. A real face is still never sent elsewhere.
  - `deploy/why.sh` shows each failed job's time in UTC and how long ago, plus **what the maker said** (its own words, keys hidden). A new section, **jobs being made now**, shows each job's stage, where it is, how many minutes it has waited, its parts, and a ⚠ after 20 minutes.
- Tests: `tests/v252.py`, plus `v185`, `v237`–`v241`, `v246`–`v251`.

## v253 — one shell: a grouped side menu, a slim header, job notices, template covers (lime)

The owner asked to re-order the whole site after the layout of an open-source AI studio (structure only; nooi's own words, drawings and code; nooi's lime, light and dark, Arabic and English). The editor (`/studio/`) and the Admin dashboard are unchanged.

- **Side menu on the start edge (computer):**
  - Home, Templates, Explore, All tools.
  - Then the groups: Image, Video, Audio, Characters, 3D, Edit, Publish, and Agents & automation (Film by 9 agents, Recipes).
  - Then My library, Settings and Admin (staff only).
  - Each group opens its tools, one group at a time; the group you're in opens by itself. The page you're on is marked in lime.
  - The menu folds to icons only, and this device remembers it. Folded, a group opens its first tool.
  - In Arabic it's on the right.
- **Slim header:** where you are (section › tool) on the start side. Search, credits, gifts, language, theme, Library, Admin and the account are on the end side, as before. The row of sections left the header.
- **Phone:** the Menu button opens the same grouped menu as a drawer, and a tool closes it.
- **Job notices:** one stack in the top corner. A job being made shows its minutes, then "Ready · Open", or "Not made" with why. A finished notice closes after 12 s. Jobs already finished when the page opened aren't announced.
- **Templates:** tall 3:4 cover cards. The kind sits in small lime capitals above the name and one line; the length and shape sit in the corners.
- **Drop anywhere** already sent a file to the right tool (since v80); its frame is lime now.
- Tests: `tests/v253.py`. `v98`, `v118` and `v224` were updated to the side menu; `v224` also no longer expects Studio as the landing page's first link (v242 changed that page).

## v254 — directing and eras in nooi Studio; more cameras and lenses

The owner asked for lenses, directing options and time periods. The open-source studio we looked at only had lenses; directing and eras are nooi's own. Every option follows the Cinema rule: a small drawing, a fixed tested wording added to the shot, and Auto leaves it to the engine.

- **Camera:** adds 70 mm film, Super 8 and a 90s camcorder.
- **Lens:** adds tilt-shift, fisheye, swirl bokeh, a halation filter, clinical sharp, warm prime, a 1970s zoom and a probe lens (12 in all).
- **Focal length:** adds 8 mm. **Aperture:** adds f/4.
- **Directing** (one chip): shot size (7), camera angle (8), pace (5), composition (6) and directing style (7). Styles are described by their traits, never by a real director's name.
- **Era** (one chip): the ancient world, medieval, the Islamic golden age, Arabian heritage (Najdi mud-brick houses and the old souk), the 1800s, every decade from the 1920s to the 1990s, today, the near future and the far future. Each sets the clothes, buildings, colours and film look of its time.
- The job keeps the client's own words as its title; the wording goes to the engine, and `meta.cinema` keeps the picks.
- Tests: `tests/v254.py`. `v93` now closes the open panel before switching tabs (with more lenses the panel is taller on a phone).

## v255 — long videos: who is in each shot, and the camera positions (after ViMax)

This follows ViMax's storyboard and camera tree (MIT; the ideas only, in our own code).

- **The agents' plan** says, for each shot, who is in it (the customer's # pictures, by name) and which camera position it's filmed from (A, B, C…). The same letter means the film cuts back to a position it used before. Older plain answers still read.
- **Each shot's first picture** gets only the pictures of the people in that shot (all of them when the plan didn't say, up to 3).
- **A shot back on an earlier camera position** is drawn from that shot's picture, so when the film cuts back, the place behind the people is the same. The other shots are drawn from the first shot, as before. Pictures are still made at the same time wherever they can be.
- The job's plan (`plan132`) now also carries `cams` and `who`.
- Tests: `tests/v255_plan.mjs`; `v136` still passes.

## v256 — Workflows: build a chain of steps, save it, run it with the price first

The owner asked for the work to be automated, after an open-source studio's Workflows page (its layout only). The engine underneath is nooi's own Recipes chain since v83: each step starts from the result of the one before on the server, is held when it starts, charged when made and given back if it fails. A failed step stops the steps after it.

- **Where:** Agents & automation → Workflows (`?view=flow256`).
- **The list:** Templates and My workflows as tall cards with the steps drawn on the cover, plus "Create a workflow". There are two new templates: Moment with music, and Sharp portrait.
- **A workflow opens on its Form:**
  - what it needs: your idea, the voice's words, the shape;
  - the steps with their prices, the total, and Run.
  - Runs appear beside it with what each step made.
- **Or on its Builder:**
  - the steps as linked cards. Add a step from Picture, Video from it, Sharper copy, Voiceover or Music;
  - change a step's words, its engine and length, move it, remove it; rename the workflow.
  - The server's rules are checked here: up to 5 steps; a video step comes first or after a picture; a sharper copy comes after a picture or a video.
- **Templates are read-only** until saved as yours. My workflows are the same list as My recipes; Recipes also shows a Music step now.
- The site's small arrow icon (`chevron`) was missing, so the menu's group arrows and Back were blank; it's drawn now.
- Tests: `tests/v256.py`; `v83`, `v83b` and `v83c` still pass.

## v257 — Best quality for a long video: the better of two pictures, and a last frame per shot (after ViMax)

nooi Studio shows a **Quality** chip when a video is made of several parts: Standard, or Best quality.

- **The agents** also write how each shot ends (`end`, a still moment).
- **Each shot's first picture** is drawn twice. The vision check (`pick257`) sees the reference picture and both candidates, and keeps the one that shows the shot best while keeping the same people and place, with nothing broken. With no text AI connected, the first candidate is kept.
- **Each shot's last picture** is drawn from its first with the planned ending. Its part gets it as the end frame (the customer's own end frame still wins on the last part).
- **Price:** 3 extra pictures a part at the picture engine's price. It's added to Generate's price before anything is made, and the server holds the same (`hqExtra257`). It applies only where the shots are drawn (not one continuous take, not a storyboard).
- Tests: `tests/v257.py` (stand-in engine and text AI) and `tests/v257_page.py`; `v136` and `v255_plan` still pass.

## v258 — a script or a chapter becomes the film (after ViMax's Script2Video / Novel2Video)

- **nooi Studio has a Script chip:** paste a screenplay, a story or a novel's chapter (up to 30,000 characters). The chip shows the word count. When the length makes only one shot, it says so (30 s or more films the whole script).
- **The agents:**
  - A long text (over 6,000 characters) is first condensed by the story editor into its key events, in order: names and looks, places, and the lines of dialogue that matter, word for word.
  - The planner then adapts it into the film's shots in its own order, with at most one quoted line of dialogue a shot, in its own language. Best quality (v257), the camera positions and the people in each shot (v255) all apply.
  - With no text AI connected, the text is cut into the shots in order, sentences kept whole.
- **The job** keeps the script once (`meta.script258`); its parts don't carry it. With no words of its own, the script's first line is the idea and the title.
- Tests: `tests/v258.py` (stand-in engine and text AI), `tests/v258_plan.mjs`, `tests/v258_page.py`; `v93`, `v98`, `v254` and `v257_page` still pass.

## v259 — the character sheet goes with the face in every shot (after ViMax's character portraits)

- A character's sheet drawn from its face (front, side and back views plus expressions, since v87/v159, `meta.face87`) is now also used. Whenever the character is used with @ — a picture, or a video's first picture — the newest finished sheet goes as one more reference picture after the faces.
- The words say which is which: "Layla = the person in reference picture 1 …; Layla's character sheet (the same person from the front, the side and the back) is reference picture 2."
- It fits in the 4 reference pictures (faces first, then sheets, then the # pictures), so the side and back views stay the same person.
- A sheet drawn from words alone (a character with no face) is never used as a reference: it may show someone else.
- Test: `tests/v259.py`; `v87`, `v159` and `v179` still pass.

## v260 — two duplicates removed (first step of the clean-up)

- The signed-in Home starts with the create box. The gift-code strip is gone from it (the header's gift button and Credits already redeem a code); the landing page keeps the strip.
- Recipes left the side menu: Workflows lists the same chains. Old links to Recipes still open.
- The audit behind this (32 pages, computer and phone) and the clean-up plan are in the session notes; the next steps need the owner's decisions.

## v261 — clean-up steps 1 and 5: one navigation, folded walls of choices

- **One navigation:** on a computer the side menu lists every tool, so the page's own row of tabs (the same list again) is hidden for Image, Video, Audio, Edit, Publish, Explore and All tools. Settings and Admin keep their tabs (they aren't in the menu). A phone keeps the tabs, since its menu is a drawer.
- **Community** is in the side menu. Going to another section from anywhere opens its group in the menu.
- **Long walls of choices are folded:** a wall of more than 12 choices on a page (Hook lab's 32 languages, Content plan, Chapter story) shows its first ten and the chosen one, with "Show all (N)" / "Show fewer". Choices inside a chip's own panel and in sheets are unchanged.
- **Staff directions:** a customer already never sees "Admin → …" lines (v82); the test now checks it on the Voice page.
- Tests: `tests/v261.py`; `v118` picks tools in the side menu on a computer. The other tests that mention tab rows still pass.

## v262 — fewer doors: the film tools are modes of nooi Studio; rarely used tools under More

The owner approved the merge. Nothing is deleted; every page still opens, and All tools still lists everything.

- **nooi Studio's mode row** is now One video · A film by 9 agents · Chapter story · Storyboard, shown on all four pages with the open one marked. Chapter story, Storyboard and the agents' film left the side menu; the menu marks nooi Studio on all four.
- **More** (the last group in the menu): Sketch to life, Coloring book, Video intelligence, Hook lab.
- **A section with one tool** (Image, Characters, 3D, Workflows) is a plain item in the menu, not a group to open.
- The menu is now: Home, Templates, Explore, Community, All tools · Image, Video, Audio, Characters, 3D, Edit, Publish, Workflows, More · My library, Settings, Admin.
- On a phone the page's tab row still lists Chapter story and Storyboard beside the mode row (to tidy later).
- Tests: `tests/v262.py`; `v253`, `v98` and `v93` follow the new menu and modes.

## v263 — look fixes from going through every page

A measured scan of 31 pages (computer, phone, Arabic phone, Arabic tablet) for cut-off text, things outside the screen and too-small buttons, plus a look at each page:

- **The agents' row** was laid out for eight agents, so the ninth dropped alone onto a second line. It's one even row for any number of agents on a computer, and three across on a phone.
- **3D World on a phone:** the view buttons ran off the screen's edge; they wrap inside it.
- **Small tap targets on a phone** (the prompt bar's fold handle, small buttons) are at least 32 px high.
- **Workflows' title** has the tool icon beside it, like every other page.
- After these the scan finds nothing on any page.
- Still inconsistent (not errors, design work to do): the create pages use three different layouts; Settings pages are a narrow centred column while others are full width; Library shows Projects above its title.
- Tests: `tests/v263.py`.

## v264 — one frame for every page (clean-up step 2)

Measured on every page: most tool pages already shared one frame (the options in a 420 px column on the start side, the result beside it). The odd ones out are fixed:

- **Settings pages** (Account, Credits, Integrations, Legal, Help) and **Hook lab** were a narrow column in the middle of the screen. They start at the same edge as every other page now; their content keeps its readable width.
- **Subtitles & dubbing** had its options on the end side. They're the 420 px column on the start side, like every other tool.
- **Chapter story and Storyboard** started 8 px off the common edge.
- **Pages under More** show no tab row on a computer.
- **A phone's tab rows** no longer repeat what moved in v262: Chapter story and Storyboard (now modes of nooi Studio), Sketch, Coloring book, Video intelligence and Hook lab (now under More). The open page's own tab stays.
- Every page's title now starts at the same edge (264 px on a 1440 px screen); Home and Explore open with a banner instead of a title.
- Not changed: Image and nooi Studio keep their gallery with the prompt bar at the bottom; Characters, Coloring book, Enhance and Voice keep their own inner arrangement.
- Tests: `tests/v264.py`; `v93` and `v90` follow the merged tab rows.

## v265 — the common frame on the last four pages: Enhance, Coloring book, Voice & audio, Characters

Every tool page now has the same frame: the options in a 420 px column on the start side (its main button in it), the result beside it. These four had their own arrangements. Their own fields, buttons and handlers are moved into the frame, never rewritten (`frame265`).

- **Enhance:** the eight tools are a compact row of choices (name only). The chosen tool's options and its Run button are the column; what you enhanced is beside it.
- **Coloring book:** every option and its button are the column; the pages it makes are beside it.
- **Voice & audio:** the open tab's form is the column; its voices and results are beside it.
- **Characters:** the list of characters and "from a photo" are the column; the chosen character (its face, looks, sheet) and its details are beside it, in two columns on a wide screen.
- An empty result side says what will appear there. A phone stacks the options first, then the result.
- Tests: `tests/v265.py`; `voice_sketch` follows the frame. The other tests of these pages still pass.
