# Nooi Studio — the master spec, step by step

> **بالعربية باختصار:** هذا الملف يرتّب مواصفات «Nooi Studio» (ملف المالك، 14 صفحة) في خطوات متتالية. لكل قسم:
> الموجود الآن، وما سيُبنى، وما لا يمكن في نسخة المتصفح الآن (يُترك لخطوة لاحقة بصراحة). الخطوة 1 هي الشكل والترتيب
> (الألوان، المقاسات، الشريط العلوي، الأقسام الثمانية، شريط الأدوات، لوحة الخصائص بأربعة تبويبات).

The owner's master spec covers four things:
- the design system;
- the screens and the "what comes next" of every button;
- the three editions (Desktop, Pad, Go) and the AI suite;
- a native engine (Rust core, C++ media, NPU and cloud AI) with the `.nooi` format.

It names a commercial editor as the bar for depth. We build our own UI under the nooi name only: no other product's names, icons, assets or copied screens.

Status: ✅ in the studio · 🟡 partly · ⬜ next · ⛔ not possible in the web app now (said plainly, never faked).

## Step 1 — Design system and the shell (spec §2, §4.1–4.4, §9.1–9.3) · v223 ✅

Done in v223 (tests/v223.py). Each row below was built:

| Spec | Before | Step 1 built |
|---|---|---|
| §2.1 "Nooi Obsidian" palette, Electric Cyan accent, the AI gradient, crimson playhead, cache line colours, Inter + JetBrains Mono | the studio's own lime theme | tokens: canvas `#0F1014`, panels `#181A20`, tracks `#14161B` / `#252830`, accent `#00F0FF`, AI gradient, playhead `#FF3B30`, text 100 / 70 / 40 %. The nooi logo keeps its own colour. |
| §2.2 icon and hit-target matrix (Desktop / Pad / Go) | 14 / 16 / 20 icons; touch sizes since v221 | the matrix per zone: header, rail, toolbar, track headers, transport, inspector, AI badge, media thumbnails |
| §4.1 header, 40 px | top bar | logo + File menu (Project settings modal; Save / Open `.nooi`) · Workspace switcher (Classic edit, Vertical short-form, Colorist, Audio) · Nooi Mate drawer (340 px) · Cloud popover (saved state, review link) · Export (cyan) |
| §4.2 left dock, 8 categories | 7 rails (Media, Audio, Text, Captions, Effects, Color, AI) | Media · Stock & AI Gen · Audio · Titles (text, captions, lower thirds) · Transitions · Effects · Stickers (+ logo) · Templates (split-screen 2–9) |
| §4.3 timeline toolbar | split, delete, tools, snap, zoom | Undo / Redo (+ history list) · Split · Delete / Ripple · Crop & Reframe (Ken Burns) · Speed menu · Color · AI Hub (sparkle grid) · Keyframe ◆ · Voice-over (3-2-1) · Render status, Snap, Zoom |
| §4.4 inspector, 4 tabs | Video, Speed, Audio, Color, Effects, Text | Video (Basic, Effects, Animation) · Color · Audio · Speed — plus Text for titles |
| AI sparkle badge on AI tools | — | the gradient badge |

## Step 2 — Project data and the timeline engine (spec §8.5–8.7) · v224 ✅
- ✅ Command undo / redo (300 steps), autosave, saving to the account.
- ✅ The magnetic main track (`studio/packages/editor-core/src/anchors.ts`):
  - V1 is the primary spine. A clip on any other track is attached to the V1 clip under it, at that clip's picture (its source second), so a trim, ripple, split, speed change or move on V1 carries it along.
  - A plain Delete on V1 closes the gap. Moving the attached clip yourself attaches it where you drop it.
  - Deleting its V1 clip keeps it. A clip that would land on another one moves to a free track.
  - The toolbar's link button turns it off and on. V1 shows **Main**, and an attached clip shows a mark.
- ✅ `.nooi` (`src/nooi.ts`) has the spec's shape:
  - frames at the project rate, `isPrimarySpine`, and source in/out frames;
  - transform properties as default + keyframes, with interp and tangents;
  - speed, color grading, audio with gain in dB, and `parentAnchorClipId` + `anchorOffsetFrames`.
  - Off-frame times keep their exact second, and the rest sits under `ext`, so a round trip loses nothing (unit tested). Anchors given only in frames, from another app, are read too.
- ✅ `.nooipack` (`apps/web/src/media/pack.ts`) is a standard ZIP:
  - it holds `project.nooi`, every media file (stored as is), and `.nooipeaks` waveforms;
  - opening one puts the media on the device and relinks it.
  - Browsers have no Zstd, so it uses ZIP deflate. Files up to 4 GB.
- ⬜ Next: speed-ramp nodes and colour masks get their real data in Steps 3 and 5 (the fields are written empty now). Upload `.nooipack` proxies for a cloud hand-off (Step 8).
- ✅ The site: **Studio** sits in the header next to Explore on a computer (where Edit was), as a button in the phone's top bar, and as a link on the landing page.

## Step 3 — Editing depth (spec §4.3, §4.4, §6.1)
- ✅ Fonts by language (7 writing systems) and 24 text effects with gradient, 3D, glow and double outline (v226).
- ⬜ Speed ramping (curve presets: Montage, Hero moment, Bullet time, Jumper; a velocity curve).
- ⬜ Keyframe curve editor.
- ⬜ Masks: linear, mirror, circle, rectangle, pen; feather and invert.
- ⬜ Chroma key, drop shadow, adjustment layers.
- ⬜ Colour: 4-way wheels, RGB / luma curves, colour masks, scopes, before / after wipe. 🟡 exists: tone, white balance, 8-band HSL, LUTs.
- ⬜ Audio: pitch, 10-band EQ, mixer with dB meters. 🟡 exists: fades, ducking.
- ✅ Motion presets, weather & light, erase & blur (v222).
- ✅ The classic editor's 20 motions (Animate.css, MIT), for any clip: they become keyframes with their own timing curves. Each tile plays its example before you choose it (v225).

## Step 4 — Content libraries (spec §4.2)
- 🟡 Titles: 3D kinetic titles, lower thirds, end credits, word-by-word captions.
- ✅ nooi Motion (v227): our own programmatic motion-graphics engine (springs, interpolation, easing, colour blends, noise, shapes and path drawing, sequences). 137 motion graphics since v235 in 14 groups (lower thirds, kinetic titles, social, charts and numbers, shapes and backgrounds, callouts, timers, sound-reactive, intros and outros, wipes and reveals, badges and offers, frames and overlays, Motion code), each drawn frame by frame from its props, with live tiles. Motion code runs in a sealed sandbox. ✅ Server and desktop export of motion graphics (v228).
- ✅ Stickers (v225): 36 icon stickers and 10 banners from the classic editor (Material Symbols, Apache-2.0). Each tile shows how it looks, and a banner's lines and colour can be set before it is added. They are added as pictures that come in with a motion.
- 🟡 Templates: split-screen layouts 2–9 and Instant montage (v223). ⬜ Numbered drop zones.
- ⬜ Stock: needs a stock provider key from the owner — asked for only when this step starts.
- 🟡 Audio: music library, AI music / SFX / TTS through the site's jobs (price first).

## Step 5 — Nooi Intelligence (spec §6.2, §8.4)
- 🟡 AI Hub + Nooi Mate (v223: the Hub grid and the Mate drawer; Mate understands everyday edits in English and Arabic on the device, including removing pauses):
  - Port the classic editor's AI tools: edit with words, replace things, voices & sound, AI voice-over, SFX / music from words, clean up voices, auto captions, translate, dub, lip-sync.
  - Add silence detection (v209 has it on the site), auto beat sync (beats exist), auto reframe / camera tracking, smart short clips, AI thumbnail, smart text correction.
- ✅ v226: Restyle with AI (56 styles, the client's model), caption translation with AI, Extend merged into one clip.
- ✅ v231: Replace a person (→ @character) or a voice, Replace the background (12 examples, your own picture or video, light matched), #pictures and @characters in the AI words.
- ✅ v233 Automatic tools in one place: remove pauses, cut to the beat, auto captions, auto reframe, auto colour, even loudness, duck the music, soft cuts, and "do it all".
- ✅ v234 Moving backgrounds and separating a person: a green / blue screen key (its colour found by itself; preview, device and server export alike), a cut-out of the person made on the device with no screen (MediaPipe, free), 16 moving scenes, drawn pictures, your own video (repeated) or picture, the light on the person matched; on V1 the background takes the clip's place and the person becomes a layer on it.
- ✅ v235 Background library: 20 Full-HD pictures (the owner's) and 11 empty studio sets by group (studios, technology, nature, business & finance), each still or moving; backgrounds made with AI (picture or moving, price first, no people / chairs / tables).
- Every AI call: price first, charge only on success, refund on failure, logged.
- ⛔ On-device NPU models (SAM-2, Whisper, RIFE…) in the browser: later, through WebGPU / ONNX Runtime Web, or the desktop app.

## Step 6 — Media intelligence and recording (spec §3, §6.1)
- ⬜ Smart folders: people, scenes, best shots, camera motion.
- ⬜ Semantic search.
- ⬜ Multi-source recorder: screen + webcam + mic on separate tracks (`getDisplayMedia` / `getUserMedia`).
- ⬜ Phone camera with teleprompter.

## Step 7 — Export Studio and review (spec §4.1, §3 stage 7)
- 🟡 Export:
  - 920 × 640 dialog;
  - batch queue for several sizes (16:9 + 9:16 with auto reframe);
  - still frame PNG;
  - SRT and audio stems;
  - social scheduler (the site's publish).
- ✅ Already there: device, server and desktop export.
- ⬜ FrameLink: a review link with timestamped comments (the site's v196 sharing and comments).

## Step 8 — The three editions (spec §5)
- 🟡 Go (phone), portrait thumb-first: v221–v222 done. ⬜ Gestures: pinch zoom, two-finger tap undo, haptics.
- 🟡 Pad (tablet), the desktop layout: v221. ⬜ Stylus brushes for masks.
- 🟡 Desktop: ⬜ dockable panels, J-K-L, hotkey profiles, dual monitor.
- ⬜ Cloud hand-off with `.nooipack`.

## Step 9 — Engine and performance (spec §8.1–8.3)
- ✅ WebGL2 compositor, Web Audio, server FFmpeg, desktop FFmpeg.
- ⬜ WebGPU path.
- ⬜ Frame cache: a GPU ring around the playhead, and render-preview segments.
- ⬜ Waveform mip levels; work in background workers.
- ⛔ The native Rust / C++ core, ACEScg 16-bit pipeline, 360° projection, 16-angle multicam, OpenFX plugins: not in the web app now. These belong to the desktop app later, if the owner wants them.
