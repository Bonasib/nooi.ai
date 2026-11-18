# Brief for Claude Fable 5.1 working on nooi.ai

How to use it: start a Claude Code session on this repository with the Fable model (`claude-fable-5-1`) and say
"Read docs/FABLE_BRIEF.md and CLAUDE.md, then do Phase 1." Give it one phase at a time. Each phase is a deliverable
with its own checks, and the owner reviews it on the preview before the next one.

---

## Who this is for, and why

nooi.ai is an AI creative studio that is going global. Customers type an idea, or upload a photo, a video or a website
address, and get videos, pictures, voices, dubbing, posters and ads. A crew of nine AI agents plans and checks the bigger
jobs. The owner reads English and Arabic, and customers use 26 languages, Arabic (right to left) among them. The goal of
this work is a platform that holds up for customers anywhere: it does what each page promises, says why when it can't, never
charges for a failure, and stays fast when many people use it at once.

`CLAUDE.md` is the project's memory. It has one section per version (v1 … v124) saying what each part does, where it lives
and how it is tested. Read the sections for the area you are changing before you change it. `docs/SCALE.md` explains the
engine send line and capacity, `docs/ROADMAP.md` the product map, and `docs/UI_MAP.md` every button.

## House rules (these come from the owner; keep them)

- Work on branch `claude/festive-brahmagupta-08tfzr`. Commit with a clear message ending with the trailers the session gives
  you. Before every commit, run `git diff --cached | grep -c "nvapi-[A-Za-z0-9]"` and stop if it isn't 0. Never commit `.env`,
  `data/`, `media/` or secrets of any kind, and never print a key in a log or a message.
- The site is one page, `public/index.html`. New work goes in its own block, `/* ================= vNNN: NAME ================= */`,
  inserted before `/* ================= LOOP + BOOT ================= */`. Wrap existing functions rather than rewriting them,
  as the earlier blocks do. Server code is `server.js`, `lib/` and `providers/`.
- Tests: each version gets `tests/vNNN.py` (Playwright with a real nooi server on its own port) and/or `tests/vNNN.mjs`, plus
  a line in `tests/run_all.sh`. Run steps in the foreground, in batches under 10 minutes, with `FREE_PERIOD=false`; the syntax
  step is lines 6-18 of `run_all.sh`. When an older test breaks, decide whether the site or the test is wrong. Fix the site
  if it is; if the test is out of date, update it and say so in `CLAUDE.md`.
- Never show a provider's name (Kie, fal.ai, Volcengine …) to customers: say "AI engine". The server already renames "kie" in
  every JSON answer.
- Never spend the owner's engine credits on your own: tests use mock engines (see `tests/kie_e2e.mjs`, `tests/v124.mjs`).
  This sandbox cannot reach the engines anyway.
- Every customer-facing text is written in English and Arabic (`L("…","…")`); the other languages come from `i18n/`. Check
  every new page at 390 px wide in Arabic and at 1440 px in English. Nothing may overflow, overlap or be cut off
  (`tests/overlap.py`, `tests/hidden_text.py` must stay at 0).
- Nothing goes live until the owner approves it on the preview (`deploy/stage.sh`). Don't open pull requests unless asked.
- Don't copy competitors' code or assets, and don't add AGPL code.

## How to work

- You are operating autonomously inside one phase. For reversible steps that follow from the phase, proceed without
  asking. Stop for destructive actions, anything that costs the owner money, or a real change of scope.
- When the owner is describing a problem or asking a question rather than requesting a change, the deliverable is your
  assessment: report and stop.
- Before reporting progress, audit each claim against a test or command output from this session. If tests fail, say so
  with the output; if something wasn't verified, say that.
- Delegate independent pieces to sub-agents and keep working while they run. For each phase, have a fresh-context
  sub-agent check the result against the phase's "Done when" list before you report.
- Keep notes in `docs/fable-notes/`, one lesson per file with a one-line summary at the top. Record what worked, what
  didn't and why. Read them at the start of each session. Update a wrong note rather than adding a second one.
- Keep changes to what the phase needs. Something else worth doing is a suggestion at the end, not a change.
- Edit files surgically; `public/index.html` is about 2.6 MB.
- End each phase with a short report: what changed and where, the test results, what is waiting for the owner, and the
  preview and deploy commands from `CLAUDE.md`. Write it in English, then Arabic.

---

## Phase 1 — global basics (customers in any country)

What exists: 26 languages, right-to-left support, policies in `docs/policies/`, a JSON data export, consent checkboxes on
face swaps, and payments with Moyasar, Tap, Stripe, PayPal and Airwallex. What is missing:

1. **Delete my account.** No self-service account deletion exists. GDPR and the app stores expect one. Add it under
   Account → Sign-in & data with a typed confirmation. Delete the customer's jobs and media, cancel subscriptions, and keep
   only what tax law requires (invoices). Write a test.
2. **Cookie consent.** There is a cookie policy but no consent banner. Show one only if the site sets cookies that aren't
   strictly necessary; first find out whether it does.
3. **Moderation that works in every language and on pictures.** `lib/moderation.js` is a nine-line English/Arabic word
   list. Text in any other language passes, and uploaded photos aren't checked at all. Add a model check before anything is
   charged: Claude Haiku 5.5 with vision on the prompt and on uploaded images, returning a structured verdict (allowed /
   blocked + category + one sentence for the customer). Keep the word list as the free first line. Pay special attention to
   minors, sexual content, and real people's faces in Replace the person. Design, but don't buy, a hash check for known
   abuse images (Microsoft PhotoDNA or Thorn Safer); that is the owner's decision.
4. **Label AI-made media.** Several countries now require AI-generated or face-swapped video to be disclosed (the EU AI
   Act's transparency rules among them; the owner should confirm with a lawyer). Add C2PA content credentials to exported
   files (an open standard with MIT/Apache tools), plus an optional visible "Made with AI" mark that is always on for face
   swaps.
5. **Money worldwide.** Only SAR and USD are offered. Write a one-page decision note for the owner, without building it
   yet: more currencies; price per country (purchasing power); who collects sales tax and VAT in each country (a merchant
   of record such as Paddle, or Stripe Tax); and local payment methods.
6. **More languages.** Add Indonesian, Vietnamese, Polish, Ukrainian, Bengali and Urdu (right to left) through the existing
   `i18n/` pipeline. Mark machine-translated languages for a native speaker's review.

Done when: account deletion and the new moderation pass their tests, and refused requests charge nothing. Exports carry
content credentials. The money note is written. The new languages pass `tests/langviews.py` and `tests/script_fonts.py`.
The full suite is green.

## Phase 2 — the nine agents, reliable

How they work now (`lib/agents.js`, client block `v91: AGENTS`):
- Quill (writer), Nova (characters), Max (director), Lumi (camera), Lyra (dialogue and voice), Echo (sound), Remy (editor),
  Duke (producer) and Iris (proofreader and QA) plan a job as one text-AI call.
- The reply is parsed by finding the first `{` and the last `}` (`llmJson` in `providers/anthropic.js`), which breaks on any
  stray brace.
- The Claude path sends raw `fetch` calls with model `claude-sonnet-5` (the current Sonnet is `claude-sonnet-5-5`), with no
  prompt caching and no refusal handling.

Make them dependable:

1. **Claude calls through the official SDK** (`@anthropic-ai/sdk`), keeping the Anthropic-compatible base URL setting that
   Qwen needs. Use exact model ids:

   | Model | Id |
   | --- | --- |
   | Claude Fable 5.1 | `claude-fable-5-1` |
   | Claude Opus 5.5 | `claude-opus-5-5` |
   | Claude Sonnet 5.5 | `claude-sonnet-5-5` |
   | Claude Haiku 5.5 | `claude-haiku-5-5` |

   Facts for these models (check the live docs when unsure):
   - Never send `temperature`, `top_p` or `top_k`; since 2026-10-21 they return a 400.
   - Don't disable thinking; set depth with `output_config.effort`.
   - No forced `tool_choice` on Fable 5.1, Opus 5.5 or Sonnet 5.5.
   - Always check `stop_reason` for `"refusal"`. Turn on the server-side `fallbacks: "default"` (beta
     `server-side-fallback-2026-07-01`).
   - Stream long requests; a Fable request can run for minutes.
2. **One contract per agent.** Each agent's part of the plan gets a JSON schema, and the reply uses structured outputs
   (`output_config.format`), so a plan always parses. The server then checks every value against the engine registry
   (models, lengths, sizes, prices; `lib/models.js`, `lib/billing.js`, `providers/kie.js`) before anything is charged.
3. **The facts as cached context.** What each engine accepts, the agents' craft notes and the brand kit change rarely. Put
   them first in the prompt, behind a `cache_control` breakpoint, and check `usage.cache_read_input_tokens` is not zero.
4. **A real check by Iris.** Make QA a second call with a fresh context. Iris grades the plan against the customer's brief
   with a written rubric (length, aspect, language, characters kept the same, no text the engine can't draw, price within
   what was shown). After the video is made, Iris looks at sampled frames with vision and compares them to the storyboard;
   v60's scene check is the starting point. A failing check gets one corrected retry before a refund.
5. **The right model for each step.**
   - Fable 5.1 at `low`/`medium` effort for the director's plan and the storyboard.
   - Haiku 5.5 for rewriting prompts into English and short translations.
   - Opus 5.5 or Sonnet 5.5 where tests show Haiku isn't enough.

   Fable costs $10 / $50 per million input/output tokens, Opus 5.5 $4 / $20, Sonnet 5.5 $2 / $10, Haiku 5.5 $0.10 / $0.50.
   Measure cost per finished job, not per request.
6. **An evaluation set.**
   - 60-100 real briefs (English, Arabic and at least four other languages; ads, stories, UGC, product videos), each with
     the checks a correct plan must pass.
   - Run them with the Batches API (half price, not urgent).
   - Change an agent's prompt only when the score goes up.
   - Show the score on Admin → Speed.
7. **Learning stays safe.** The agents learn from web pages and results (`AGENTS_AUTO_LEARN`). Keep the existing guards, and
   keep a review list where the owner approves a lesson before agents use it.

Done when: 0 parse failures across the evaluation set; every plan passes the registry check. Iris catches the planted
mistakes in the set (wrong length, wrong language, a model that can't do the shot). Cache reads show up in usage, and cost
per job is reported. `tests/agents.py` plus a new test are green.

## Phase 3 — the video editor at CapCut level and beyond

What exists:
- Keyframes, speed and ramps, transitions, text and word animations, captions, and 14 procedural effects.
- Infographics, color looks and `.cube` LUTs, layers and keying, erase and blur, motion tracking.
- AI voice, music and sound effects, AI commands in English and Arabic, Extend shot, and pro export formats.

The gaps that matter most to customers:

1. **Export speed.** Export records the preview in real time with MediaRecorder: a 3-minute video takes 3 minutes, and the
   phone must stay awake. Encode with WebCodecs (`VideoEncoder`, faster than real time where the browser supports it), keep
   MediaRecorder as the fallback, and offer a server render from the project file for long videos.
2. **Tracks.** A second video track for picture-in-picture and overlays, with blend modes and shape masks (circle,
   rectangle, feathered).
3. **Sound.**
   - Waveforms on the timeline.
   - Ducking (music dips under speech).
   - Beat markers (cut to the music).
   - One-tap voice cleanup (the audio lab exists).
4. **Edit by text.** Transcribe, then show the words. Deleting words cuts the video, and one tap removes silences and
   filler words ("um", "يعني").
5. **Auto-reframe.** Turn 16:9 into 9:16 or 1:1 by following the subject; the existing tracking is the start.
6. **Video background removal and stabilization** through an engine (see Engines).
7. **Projects you don't lose.**
   - Autosave and versions.
   - Reopen on another device.
   - Proxies for long and 4K files.
8. **Templates from a brief.** The agents fill an editor template (texts, cuts, music, captions) from the customer's
   product or website.

Done when: a 60-second 1080p export takes clearly less than 60 seconds on a mid-range laptop, and the fallback still
works. Each new tool has a phone and desktop test, as `tests/editor_real.py` and `tests/editor_pro.py` do. Nothing
overflows at 390 px in Arabic.

## Phase 4 — AI tools built on Claude

Claude reads, plans, writes, checks pictures and frames, and writes code. It does not make pixels or sound; engines do that
(next section). Use it for:

1. **Website → ad.**
   - Fetch the customer's site with the `web_fetch` server tool (`web_fetch_20260209`, a URL the customer gave).
   - Read a screenshot with vision.
   - Produce a brand kit (colours, fonts, tone, offer), three ad scripts, a storyboard, captions in the customer's
     language and a poster brief.
   - Then hand it to UGC ads or the agents.
   - `lib/site.js` and `/v1/analyze-site` are the start.
2. **Posters with exact text.** Image engines misspell text, so generate the background picture with an engine, then lay out
   the text with code (SVG/HTML → PNG on the server) in the brand's fonts, Arabic included. Claude checks the result with
   vision and fixes the layout.
3. **Motion graphics.** `lib/motion.js` already asks the text AI for a `draw(ctx,t,W,H)` function. Render a few frames,
   let Claude look at them, and correct the code once before the customer sees it.
4. **Color grading from a reference.** The customer gives a frame they like. Claude reads both frames and returns grade
   settings (the editor's `cg` values, or a LUT). Apply them, compare frames, and adjust once.
5. **Translation and dubbing.**
   - Translate the script with timing kept (each line fits its original duration) and a glossary of names and brand words.
   - Have a second pass check meaning and length.
   - Then make the voice with the TTS or dubbing engine and lip sync. Translate & dub and CAMB.AI exist; this raises their
     quality.
6. **Video analysis.** The Video intelligence page: sampled frames plus the transcript give summaries, answers with
   timestamps and alerts.
7. **Motion capture and tracking.** Claude writes and checks the integration; the engines do the work. It reviews tracked
   frames with vision and flags drift.

Done when: each tool has a mock-engine test. Costs are shown before anything paid runs. Results are checked by vision before
the customer sees them.

---

## Engines (Claude doesn't replace these)

| Job | Connected now | Add or improve |
| --- | --- | --- |
| Video | AI engine (Kling, Seedance, Veo, Hailuo, WAN, Grok …), fal.ai for swaps | A second provider for the most used models, each with its own send line |
| Pictures | AI engine (Nano Banana, GPT Image, Seedream, FLUX …), NVIDIA FLUX | — |
| Voice and cloning | ElevenLabs (direct and through the AI engine), Piper backup | — |
| Speech to text | OpenAI / ElevenLabs speech-to-text | Word timings for edit-by-text |
| Dubbing | ElevenLabs Dubbing, CAMB.AI, NVIDIA blueprint | The Claude translation pass (Phase 4) |
| Lip sync | Volcengine on the AI engine, Sync Lipsync 2 Pro on fal.ai | — |
| Music and sound effects | Suno and ElevenLabs on the AI engine | — |
| Segmentation and tracking | On-device tracking, SAM 3D for objects | A video segmentation model (SAM 2 class; check its license) for background removal, masks and auto-reframe |
| Motion capture | On-device body capture | A cloud pose model for long or crowded videos |
| Upscale and frames | Topaz on the AI engine, Real-ESRGAN, ffmpeg 60/120 fps | — |
| 3D | Model Studio 3D, Tripo, Meshy, World Labs, NVIDIA TRELLIS | — |
| Moderation | Word list | Claude Haiku 5.5 vision check (Phase 1), a hash check for known abuse images (owner's decision) |
| Text, plans and checks | Gemma, NVIDIA, Claude or Qwen | Claude through the SDK with the models above (Phase 2) |

Before adding a paid engine, show the owner its price per use and what the customer is charged, and wait for a yes.
