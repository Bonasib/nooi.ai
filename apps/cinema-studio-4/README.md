# Cinema Studio 4 (UI prototype)

A single-page studio UI: Director’s Panel, 21 motion presets, 8 templates, a 512-character prompt,
an aspect-aware preview and a mock AI co-director. Generation is mocked (`src/lib/higgsfield.ts`,
2 s delay, sample video) so it can be wired to a real video API later.

> The app is labelled “Higgsfield AI — Cinema Studio 4” as requested. Higgsfield is another
> company’s name: rename it (logo text, `<title>`, `src/lib/higgsfield.ts`) before any public use.

## Run

```bash
cd apps/cinema-studio-4
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (type-check + lint)
npm start          # serve the build
```

## Stack

Next.js 14 (App Router) · TypeScript (strict) · Tailwind CSS 3 · zustand · lucide-react · framer-motion.
No external images — gradients and lucide icons only.

## Where things are

| File | What it does |
| --- | --- |
| `src/app/page.tsx` | Layout: 3 columns on desktop (Director + Motion · Preview + Prompt · Templates + Chat), stacked on phones with the preview first |
| `src/store/useStudioStore.ts` | zustand store: all settings, `setTemplate` (sets template, motion and prompt), `generate`, `reset` |
| `src/lib/data.ts` | Cameras, lenses, eras, genres, f-stops, motion presets, templates |
| `src/lib/higgsfield.ts` | `generateCinemaStudio4(payload)` — the mock to replace with the real API call |
| `src/lib/utils.ts` | `cn`, icon lookup by name, aperture formatting, aspect helpers, safe ids |
| `src/components/studio/*` | Header, DirectorPanel, MotionPresets, TemplateGallery, PromptBox, PreviewCanvas, ChatPanel |

## Notes

- The preview frame keeps the chosen aspect ratio and is never taller than ~60% of the screen; the
  video uses `object-contain`, so the whole video always shows inside the frame. Shot details sit
  under the frame, never on top of the video or its controls.
- Keyboard: every control is a native button/select/input with a visible focus ring; the aspect
  ratio is a radio group (arrow keys); Ctrl/⌘ + Enter generates from the prompt; “Skip to the prompt”
  link for keyboard users.
- Wiring the real API: replace the body of `generateCinemaStudio4` with a call to your own server
  route (keep API keys on the server, never in the browser) and return `{ id, status, videoUrl }`.
