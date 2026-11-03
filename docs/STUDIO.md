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
