# Open-source parts inside nooi

What nooi ships from other projects, where it lives, and under which licence. The full licence texts are in
`public/editor131/LICENSES.txt` (served with the page).

## Video editor (v131)

| What | From | Licence | In nooi |
|---|---|---|---|
| 22 GPU transitions (GLSL) | [gl-transitions](https://github.com/gl-transitions/gl-transitions) 1.76.1 (npm `gl-transitions`) | MIT; each transition's author is kept in `transitions.json` | `public/editor131/transitions.json` — the shader code as published, with nooi names (`gl_push`, `gl_cube`…), each transition's defaults and parameter types. Run by `glRun131` in `public/index.html` (WebGL 1). |
| 20 text motions | [Animate.css](https://github.com/animate-css/animate.css) 4.1.1 | MIT | Keyframes, durations and timing curves rewritten as data for the canvas (`AC131` in `public/index.html`); no CSS file is shipped. |
| 15 colour looks | [CSSgram](https://github.com/una/CSSgram) 0.1.3 | MIT | Each recipe's filter + colour / gradient layer + blend mode rewritten for the canvas (`EDX_LOOKS` additions in `public/index.html`) under nooi's own names (Linen, Sea breeze, Ember…). |
| 38 icons for banners and stickers (89 since v149: sticker groups) | [Material Symbols](https://github.com/google/material-design-icons) by Google, via npm `@material-symbols/svg-400` 0.48.1 (rounded, filled) | Apache-2.0 | `public/editor131/icons.json` — each icon's SVG path (viewBox `0 -960 960 960`), drawn with `Path2D`. |

Banners, stickers and their motion are nooi's own designs built on those icons; nothing else is copied from other
editors. The server's drag copy (`lib/scrub131.js`) uses the ffmpeg already on the server.

## Video editor export (v139)

| What | From | Licence | In nooi |
|---|---|---|---|
| Frame-exact video decoding and encoding in the browser (WebCodecs), MP4/WebM writing | [mediabunny](https://github.com/Vanilagy/mediabunny) 1.62.1 (npm `mediabunny`) | MPL-2.0 — used unmodified; its licence and source are in `node_modules/mediabunny` | Served as it is from `/vendor/mediabunny.mjs` (`server.js`); used by the editor's frame-by-frame export (`edRender139` in `public/index.html`). No mediabunny file is changed. |

## Video editor, combined (v140)

No code was copied. These three open editors were read for ideas only, and each idea was written again in nooi's own code:

| Idea | Seen in | Licence | In nooi |
|---|---|---|---|
| Tools in a few groups; subtitle files in and out (.srt / .vtt) | [OpenCut](https://github.com/OpenCut-app/OpenCut) | MIT | `G140`, `subsIn140` / `subsOut140` |
| Every AI tool in one place; LUT (.cube) and colour-by-colour (HSL) grading | [DonkeyCut](https://github.com/DonkeyCut/Donkey) | Apache-2.0 | `panel140`, `cube140`, `grade140` (own WebGL shader, own built-in looks) |
| One switch that cleans up voices | [Concat](https://github.com/jub0t/Concat) | AGPL-3.0 — idea only, none of its code | `vcBuild140` (Web Audio filters), `denoise140` (own spectral gate and FFT) |
| Sound waveforms on the timeline, snapping, keyframes on any setting, masks with soft edges, shapes (v141) | OpenCut | MIT | `paintWf141`, `snap141`, `edxMo` opacity/volume, `lySoft141`, `shDraw141` |
| A wide font library (v141) | DonkeyCut | Apache-2.0 | 38 more Google Fonts in `FONTS` |
| Generated shots beside the timeline; an assistant that edits by chat and keeps the conversation; guides over the preview (thirds, centre, safe margins, short-video keep-out) (v143) | DonkeyCut | Apache-2.0 | `media143`, `chat143`, `guides143` |
| The editor's layout — add panel on the left, details of the selection on the right, timeline across the bottom; on a phone a tool bar that turns into the selected clip's tools (v143) | CapCut (closed product) | Not open source — the common layout and public feature names only; no code, artwork or wording | `VIEWS.edit` (v143), `CTX143` |
| Dragging anything from the add panel onto the timeline or the picture; text styles as ready tiles; a background removed and something put behind; voices isolated; music that ducks under voices (v144) | CapCut (closed product) | Not open source — public feature names only; no code, artwork or wording | `DND144`, `TS144`, `bgRun144`, `iso144Run`, `duckGain144` (all our own code) |
| News tickers (a band with a label and crawling headlines) (v144) | TV news graphics in general | A common broadcast convention — no one's design copied | `TK144`, `tkDraw144` |
| Smootherstep easing for transitions, 6t⁵ − 15t⁴ + 10t³ (v144) | Ken Perlin's "improved noise" (2002) | A published mathematical formula | `ease144` |
| Removing a background on the device (v144) | the on-device AI model already in nooi (`laiModels().bg`, see the on-device AI rows) | as listed there | `bgRun144` (sampled frames, nearest mask per frame) |
| A pitch shifter from two delay lines whose delay ramps, each faded out as it jumps back (v145) | Chris Wilson's "Jungle" Web Audio demo | MIT — the method only, our own code | `pitch145` |
| Clip tools by name — crop, rotate, canvas, animations in & out, fades, voice changer, reverse, replace, extract audio (v145) | CapCut (closed product) | Public feature names only; no code, artwork or wording | `clipEdit145`, `anim145`, `vcFx145`, `rev145`, `rep145`, `xa145` |
| Reversing in short pieces joined last-first (bounded memory) (v145) | ffmpeg's own `reverse` / `areverse` filters (LGPL/GPL tool, run as a program) | used as a separate program, not linked | `lib/edit145.js` |
| Several items selected at once, groups, copy & paste on the timeline (v146) | DonkeyCut (Apache-2.0) and CapCut (closed product) | Ideas and feature names only — no code, artwork or wording copied | `sel146`, `group146`, `copy146`, `paste146` |
| Markers on the ruler and beat marks from the music (v146) | Common editor features (CapCut's "beat" marks among others) | Feature names only | `mkAdd146`, `beats146` |
| Finding the beat: loudness onsets, the tempo by autocorrelation with a gentle preference near 120 a minute, beats placed one period apart and nudged to the onset (v146) | Published beat-tracking methods (e.g. D. Ellis, "Beat Tracking by Dynamic Programming", 2007) | Methods from papers, our own simpler code | `beats146` |
| Stabilising video in two passes (motion measured, frames moved back along a smoothed path) (v147) | vid.stab (GPL-2.0) through ffmpeg's `vidstabdetect`/`vidstabtransform`; ffmpeg's own `deshake` as the fallback | Run as a separate program, not linked or copied | `lib/edit147.js` |
| Auto reframe, remove silences, stabilise — the tool names (v147) | CapCut and other editors (closed products) | Public feature names only; no code, artwork or wording | `reframe147`, `sil147`, `stab147` (our own code) |
| A clip's frames sent as one contact sheet and cut back into masks (v147) | Our own idea (as in v137's contact sheet for vision) | — | `bgEng147`, `bgSplit147` |
| AI agents that edit the editor's projects, several timelines in one project, a brush that paints the background-removal mask (v148) | [Concat](https://github.com/jub0t/Concat) (its feature list) | AGPL-3.0 — ideas only: none of its code read into, copied or reverse-engineered | `lib/edit148.js`, `op148`, `seqGo148`, `brush148` (our own code) |
| The agents' editor tools as MCP tools with JSON Schema inputs and a frame returned as image content (v148) | The Model Context Protocol specification | Open specification | `TOOLS148` in `lib/edit148.js` |
| Captions translated on the device: the browser's built-in translator (v149) | The Translator API (WICG Translation API, built into Chrome) | Web platform API — no code copied | `trBrowser149` |
| Captions translated by an on-device model when the browser has none (v149) | Opus-MT models (Helsinki-NLP, via Xenova/transformers.js ports) and M2M-100 (Meta, via Xenova) — downloaded by the visitor's browser from Hugging Face, not shipped | Opus-MT: CC-BY-4.0 · M2M-100: MIT · transformers.js: Apache-2.0 | `trModel149`, task `translate` in `public/local-ai-worker.js` |
