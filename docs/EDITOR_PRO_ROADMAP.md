# The editor: the road to After Effects / Premiere / DaVinci level

The owner asked for "the best of the best" — a professional editor and motion-graphics tool, Arabic and English, fully
automated with the AI tools the site already has. This is the gap list (public knowledge of the big tools, none of
their code) and the phases. Each phase ships tested and working with the whole site before the next starts.

## What the editor has today (v131–v171)
Timeline with lanes, waveforms, snapping, markers, beats, groups, multi-select, copy & paste · trims, split, speed
ramps, smooth slow motion · transforms with keyframes (one easing per clip), opacity and volume keyframes · LUTs
(.cube), HSL per colour, 15 looks, exposure/contrast/saturation/temperature/tint · layers with keying, cut-outs,
blend modes, soft edges · text motions, kinetic type, 102 fonts (14 Arabic) · stickers, shapes, frames, filters,
transitions · motion engine 2 (spring easing, camera, depth shadows, motion blur in export) · captions in 40
languages, translation · AI: reframe, stabilise, silences, voices, dubbing, sound design, agents that edit and review
· frame-exact export up to 4K · phone studio layout.

## Gaps against the big tools → phases
| # | What the big tools have | Status |
|---|---|---|
| 1 | **Per-keyframe easing with a graph editor** (AE's graph editor; Premiere's temporal interpolation) — Bézier presets incl. overshoot / elastic / bounce / hold, a custom curve, keyframes dragged in the graph | **v193** |
| 2 | **Colour wheels (lift / gamma / gain), a luma curve and live scopes** (DaVinci's primaries, waveform / vectorscope / histogram) | **v193** |
| 3 | **Adjustment layers** (colour on everything below, AE / Premiere) | **v193** |
| 4 | **Per-clip motion blur** by shutter angle on keyframed moves (AE) | **v193** (export) |
| 5 | **Loudness meter and normalise** (−14 LUFS for YouTube / −16 for podcasts, DaVinci Fairlight) | **v193** |
| 6 | **Export presets** with frame rate and bitrate per platform, a size estimate (Premiere / Media Encoder) | **v193** |
| 7 | **Pro shortcuts**: J / K / L shuttle, I / O, ripple delete, Home / End, a shortcuts sheet | **v193** |
| 8 | **One-tap AI "pro polish"**: ducking, loudness, easing, exposure match across clips | **v193** |
| 9 | RGB curves per channel, hue-vs-hue / hue-vs-sat / hue-vs-lum curves, qualifiers (secondaries) with an eyedropper and a mask view, power windows with tracking | **v194** |
| 10 | Nested compositions (pre-comps — a timeline as a clip, drawn live, its sound in the export) and motion templates with editable fields (built in + the selection saved as one) | **v194** |
| 11 | Shape paths drawn with a pen, trim paths with a write-on / erase, a repeater, words along a path | **v194** |
| 12 | Sound per track: EQ, compressor, de-esser, noise gate; side-chain ducking per track (export; EQ / compressor / de-esser live) | **v194** |
| 13 | Multicam sync by sound; proxies for heavy footage | phase 3 |
| 14 | 3D camera with depth of field across all layers (AE's 3D), light sources | phase 3 |
| 15 | Collaboration: comments on frames, versions, shared projects (team review) | phase 3 |

## What phase 2 did not do (honest limits)
- Power-window tracking is block matching of a luma patch at 8 steps a second on a 160-px copy — it follows a subject that moves and
  keeps its look; it loses one that spins, hides or changes size a lot (re-track from that moment).
- A pre-comp nests one level (a timeline inside a timeline inside a timeline is refused); the music and voice-over belong to the
  project, so a nested timeline brings its clips' sound and its sound effects, not a music of its own.
- The noise gate and the side-chain ducking act in the export mix (they need the whole sound); EQ, compressor and de-esser also play
  live. A clip already routed through the voice changer or voice cleanup keeps that chain in the preview.
- Words along a path: letters one by one for Latin scripts; whole words for Arabic (a letter at a time would break the joining).

## Rules for every phase
- Our own code and sounds; ideas only from the big tools' public behaviour. Licences noted in `docs/THIRD_PARTY.md`.
- Arabic and English on every control; RTL layouts; every new control reachable by keyboard and by touch.
- Preview and export must match; a feature that only works in one of them doesn't ship.
- One icon set (`ic()`), no emoji; the same card / seg / slider templates as the rest of the editor.
- A test per phase (`tests/v19x.py`) plus the editor suites, hidden-text, i18n, fuzz and equal-layout checks.
