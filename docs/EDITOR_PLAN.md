# nooi video editor — CapCut + DonkeyCut + nooi (plan, v143–v147)

The owner asked (after v142) for the editor to look and work like DonkeyCut and CapCut, with every nooi feature kept.
Ideas only, written in our own code and our own icons: DonkeyCut is Apache-2.0 (its code may be read, nothing copied here);
CapCut is a closed product (only its public feature list and the common editor layout are used, never its artwork or text).

## What each one has (public sources)

| | CapCut | DonkeyCut | nooi before v143 |
|---|---|---|---|
| Layout | assets (left) · player (centre) · details of the selected item (right) · timeline (bottom); phone: player, timeline, a bottom tool bar that changes when a clip is selected, tools in sheets | side panel with the generated shots · player · multi-track timeline · AI chat that edits | groups rail + settings + player + timeline (v142) |
| Clip tools | split, trim, delete, duplicate, speed (curves), freeze, reverse, mirror, rotate, crop, replace, opacity, blend, stabilise, animations in/out, transitions | multi-select, groups, copy/paste, text wrap grips, guides (thirds, centre, safe margins, short-form keep-out) | split, trim, delete, duplicate, speed, slow motion, speed ramps, smooth frames, freeze, flip, transform keyframes, opacity/volume keyframes, transitions |
| Colour | filters, adjust (basic, HSL, curves) | LUTs, colour by colour, HDR delivery | looks, film LUTs + .cube import, HSL, adjust |
| Audio | music library, sound effects, record, extract audio, voice changer, fades, noise reduction, beat marks | music, voice-overs from chat, silence detection | music, voice record, AI voice-over, AI music, AI sound effects, 18 sound effects, clean-up voices, waveforms |
| Text & graphics | text, templates, stickers, auto captions, text-to-speech | captions, transcription | text + styles + animations, 102 fonts, banners, stickers, shapes, infographics, motion graphics, logo, auto captions, SRT/VTT |
| Effects | video effects, body effects, overlays, chroma key, masks, remove background | effects | weather & light effects, clip effects, layers with masks and keying, erase & blur regions, motion tracking, 3D |
| AI | auto captions, remove background, auto reframe, AI effects | assistant that edits by chat (selection = "this", @time, one undo per turn), brief → script → shot plan → shots on the timeline, image/video/voice/music generation | AI command bar (free edits), extend shot, edit with words, replace things, AI frame edit, voices & sound, voice-over, dub, lip-sync, translate, captions, new shot from start/end frame |
| Projects | cloud projects, export | cloud or local projects, share a read-only link, several timelines | projects on the server, frame-exact export, 24–120 fps, MP4/WebM |

## The nooi editor after the rebuild

- **Computer**: top bar (project name, undo/redo, format, projects, export) · left: tool rail + **asset panel** (Media library with your results and uploads, Audio, Text, Stickers & graphics, Effects, Transitions, Captions, Filters, AI assistant) · centre: **player** (guides, ratio, full screen, time) · right: **details of the selected item** (clip → Basic, Speed, Color, Audio, AI; text → Text; sound → Sound; …; nothing selected → Project) · bottom: **timeline** with its tool row.
- **Phone**: top bar (back, format, export) · player · play row (time, play, undo, redo, full screen) · timeline · **bottom tool bar** (Edit, Audio, Text, Stickers, Effects, Filters, Captions, AI …) that turns into the **clip's tools** when something is selected (Split, Speed, Volume, Animation, Delete, Duplicate, Freeze, Mirror, Color, AI …); each tool opens a **sheet**.
- **Assistant** (DonkeyCut idea): a chat thread per project; "this" = the selection; @0:12 = that moment; one undo step per turn; paid steps show the price and wait for OK.

## Stages

1. **v143 — the layout** (done): the CapCut / DonkeyCut layout on computer and phone, the asset panel with a media library of your results, the details panel for the selection, the phone tool bars and sheets, the assistant thread, guides on the player, project name.
2. **v144 — drag everything** (done, asked by the owner after v143): every tile drags onto the timeline or the picture (mouse or long press, also out of picker sheets); news tickers; text styles; each clip's transition length with smoother easing; background removed on the device with a colour, gradient, blur or picture behind; voice isolation (AI engine, priced per minute first); music that ducks under voices; the AI audio tools in one panel.
3. **v145 — the clip's settings, rebuilt clean** (done): the clip's details as their own panels (Edit · Speed · Animation · Audio), no old page underneath; new clip tools: crop, rotate 90°, reverse, canvas (fill / fit / blur / colour / picture), clip animations in & out, audio fades, voice changer, replace clip, extract audio.
4. **v146 — the timeline, rebuilt clean** (done): the timeline written again in one function (same lanes and marks); several selected at once, groups, copy & paste, markers and beat marks, with snapping to them; the old timeline code deleted (the remaining panels still come from the old page).
5. **v147 — AI extras** (done): background removal on the AI engine as an option (frames on contact sheets of nine, price first), auto reframe (the crop follows what moves), stabilise (on the server, free), remove silences, the assistant's @time, @range, @selection, @clip and @marker.

Each stage: tests, related suites, commit, push, report with the update commands; nothing goes live before the owner approves it on the preview.
