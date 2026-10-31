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
| 13 | Multicam — the other angles lined up by their sound (a late one trimmed, an early one shifted), stacked as full-frame layers, switched with cuts from a tile per angle (keys 1–9), undoable; proxies — a 540 px copy made on the server for the preview, the export reads the original | **v196** |
| 14 | A 3D camera over every layer — depth and tilt per layer, dolly / pan / tilt / focal length with keyframes and easing, presets (dolly, push, orbit, rack focus, drift), depth of field by distance from the focus plane and the aperture; point lights that shade the layers by tilt and distance and cast their shadows; ambient level | **v196** |
| 15 | Team review — comments pinned on a frame (a pin at that moment for everyone), done / delete, named versions with restore, projects shared by email invite or link with a review or edit role; the Team button beside Projects | **v196** |
| 16 | **Keyframes on every property** (AE's stopwatch on each control; Premiere's effect keyframes) — a stopwatch beside every slider in the editor (layers, colour grade, look, text, captions, music), a key set at the playhead, a slider change at another moment sets the next, easing per key (smooth / linear / in / out / hold), a sheet that lists them; the same values in the preview and the export | **v198** |
| 17 | **Text-based editing** (Premiere) — the caption words as the video's transcript: tap words to take out, the clips are trimmed or split there and every track closes the gap (texts, layers, sounds, markers, words, camera keys, the keyframes above); filler words (um, uh, آآ, يعني…) in one tap; undo puts it back | **v198** |
| 18 | **Playback quality** (Premiere's playback resolution) — Full / ½ / ¼ for the preview canvas only; an export keeps its size | **v198** |
| 19 | **Media management** (Premiere's Link Media, Consolidate) — missing clips, layers and sounds listed in one sheet and relinked by choosing the file again (cuts, timing and settings kept); everything only on this device put on the account in one tap; a notice when a project opens with files gone | **v198** |
| 20 | **Track mattes** (AE's alpha / luma mattes) — a layer shows only where another layer is: by its shape (alpha) or its brightness (luma), inverted or not; the matte layer itself is not drawn; "the layer above" or any layer by name | **v202** |
| 21 | **Expressions, the two everyone uses** (AE's `loopOut` and `wiggle`) — on any keyframed slider: after the last key loop or go back and forth; a wiggle (amount, times a second) on top, the same every play | **v202** |
| 22 | **Render with alpha** (AE's RGB+Alpha, Premiere's ProRes 4444) — the clips hidden, titles / layers / shapes over nothing: WebM VP9 with alpha for web pages and OBS, ProRes 4444 .mov for Premiere / AE / DaVinci / Final Cut; sound included | **v202** |
| 23 | **Export a part + a still** (Premiere's work area / Export Frame) — from … to … seconds or "This clip", cut on the server exactly; the current frame saved as a PNG | **v202** |
| 24 | **History panel** (Premiere / Photoshop) — every step named after the control that made it; tap any to go back there | **v202** |
| 25 | **Motion graphics library** (animos-style) — 20 named effects (Orbit … Checklist), showcases of up to 12 pictures (Totem Wall, Spread Rows, Iso Cascade, Wheel Carousel, Cascade Deck, Orbit), the reference motions (kinetic promo, vlog kit, app burst), picture slots and five one-tap recipes; the same drawing in the preview and the export | **v206** |
| 26 | **Motion scenes on a phone** — Auto preview size (540 on a phone, smaller while slow), no soft shadows in a phone's preview, frames never starve taps; new scenes after the others + Line them up; Pictures & videos first in the scene's sheet (several at once, from the device, your results or the timeline); videos inside scenes, frame-exact in the export | **v207** |
| 27 | **Plays on a phone** — a clip still loading never holds the clock past 2.5 s (Loading tag, a light copy asked), a new scene is seen at once, no clock in the row under the video (history on a long press of Undo), the row and the foot bar fit with Delete beside Split, a tap picks a timeline item | **v208** |
| 28 | **Several at once, studio looks, a studio behind you, cleaner speech, DJ & voices** — Select several in the media list (in order), many files per upload; moving gradients, liquid glass that bends the video, liquid metal, 3D objects (preview = export); background → moving / studio set / video + soft edges, light wrap, floor shadow, colour match; pauses, fillers, repeats and frozen frames cut; DJ effects per track + beats; background-only sound, a speaker replaced by another voice; fonts for every script, 100+ languages | **v209** |

## What phase 2 did not do (honest limits)
- Power-window tracking is block matching of a luma patch at 8 steps a second on a 160-px copy — it follows a subject that moves and
  keeps its look; it loses one that spins, hides or changes size a lot (re-track from that moment).
- A pre-comp nests one level (a timeline inside a timeline inside a timeline is refused); the music and voice-over belong to the
  project, so a nested timeline brings its clips' sound and its sound effects, not a music of its own.
- The noise gate and the side-chain ducking act in the export mix (they need the whole sound); EQ, compressor and de-esser also play
  live. A clip already routed through the voice changer or voice cleanup keeps that chain in the preview.
- Words along a path: letters one by one for Latin scripts; whole words for Arabic (a letter at a time would break the joining).

## What phase 3 did not do (honest limits)
- Multicam lines angles up by their loudness envelope (100 Hz, up to ±90 s); angles with no shared sound (or silent ones) are refused with a
  message, and a drifting camera clock (different sample rates over a long take) isn't corrected. The angles stay full-frame layers, so
  the timeline shows them as layer lanes rather than one multicam clip; cuts live in the multicam sheet, not as splits.
- A proxy is one 540 px VP9 copy per clip (made once, kept with the account). Picture and sound in the preview come from it, which is why
  waveforms and colour scopes read a touch differently until the export, which always uses the original.
- The 3D camera moves the layers over a fixed background (the clips track is the set); layer tilt is an affine foreshortening (cos) with a
  small shear, not a true perspective warp, and the selection outline / drag handles stay at the layer's flat position. Lights are
  point lights painted as radial tints on the lit layer; shadows are the layer's silhouette offset away from each light — there is no
  shadow from one layer onto another's depth, and no shading of the clips track.
- Sharing is by email (claimed at the invitee's first sign-in) or a link token; a review member can't save (the page says so); versions
  are capped at 30 per project; the agents' operation log (v148) stays the owner's — a member sees an empty one.

## What phase 4 did not do (honest limits)
- The stopwatch animates numbers (sliders). Colours, pickers and switches aren't keyframed; a clip's own position / size / rotation keep
  the v91 keyframes they already had (`mo.*`), and the camera keeps its own (v196). Keys sit on timeline time, so a clip moved by hand
  keeps its keys where they were (a transcript cut moves them along with everything else).
- Text-based editing works on the caption words the editor already has (auto captions or imported subtitles); their timing is the
  cut's timing — a word boundary 100 ms off cuts 100 ms off. The transcript shows up to 2000 words.
- Playback quality lowers only the preview canvas; a browser that is slow for other reasons (a heavy 3D stack at ¼ is still a 3D
  stack) stays slow, and the scopes read the smaller picture.
- Relinking needs the file chosen by hand (no search of the device's folders — a browser can't); a relinked clip becomes an upload
  (its link to the result it came from is dropped).

## What phase 5 did not do (honest limits)
- A matte is one layer over another: no chains (a matte of a matted layer is drawn without its own matte), adjustment layers can't be
  mattes, and a luma matte is read on a copy at most 960 px wide (fine edges soften a touch on a 4K export).
- Loop and wiggle apply to the v198 slider keyframes only (not to a clip's own `mo.*` motion keys or the 3D camera); the wiggle is a
  smooth, repeatable mix of three sines, not true noise, and the stopwatch's live number shows the keyframed value without the wiggle.
- A transparent render hides the clips track entirely (the overlay is everything else); it is capped at 30 s and 1920 px, the frames go
  to the server as WebP (lossy, quality 92) so the encode happens there, and the music / voice-over / sound effects are included but the
  hidden clips' sound is not. A colour grade set on a clip does not touch the overlay. Browsers that can't make WebP are refused.
- A part is cut by the server (needs the nooi server; the exact H.264 pass-through is skipped so the cut lands on the frame); the
  library keeps the whole timeline's length in its row. The still is the preview canvas (1080 px on the long side), not a 4K frame.
- History names a step after the control last touched before the save (a change made by the AI agents or a keyboard shortcut reads
  "Change"); the list is the undo stack (60 steps).

## Rules for every phase
- Our own code and sounds; ideas only from the big tools' public behaviour. Licences noted in `docs/THIRD_PARTY.md`.
- Arabic and English on every control; RTL layouts; every new control reachable by keyboard and by touch.
- Preview and export must match; a feature that only works in one of them doesn't ship.
- One icon set (`ic()`), no emoji; the same card / seg / slider templates as the rest of the editor.
- A test per phase (`tests/v19x.py`) plus the editor suites, hidden-text, i18n, fuzz and equal-layout checks.
