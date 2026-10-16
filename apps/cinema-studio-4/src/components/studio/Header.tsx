'use client';

import { useRef } from 'react';
import { Clapperboard, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { useStudioStore } from '@/store/useStudioStore';
import { ASPECT_RATIOS } from '@/lib/data';
import { aspectParts, cn, rovingIndex } from '@/lib/utils';
import type { AspectRatio } from '@/types';

function RatioGlyph({ ratio }: { ratio: AspectRatio }) {
  const [w, h] = aspectParts(ratio);
  const s = 14 / Math.max(w, h);
  return (
    <span aria-hidden className="grid h-4 w-4 place-items-center">
      <span className="rounded-[2px] border border-current" style={{ width: w * s, height: h * s }} />
    </span>
  );
}

export default function Header() {
  const aspectRatio = useStudioStore((s) => s.aspectRatio);
  const setAspectRatio = useStudioStore((s) => s.setAspectRatio);
  const generate = useStudioStore((s) => s.generate);
  const reset = useStudioStore((s) => s.reset);
  const isGenerating = useStudioStore((s) => s.isGenerating);
  const canGenerate = useStudioStore((s) => s.prompt.trim().length > 0);
  const canReset = useStudioStore((s) => s.prompt.length > 0 || s.resultUrl !== null || s.selectedTemplate !== null);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const next = rovingIndex(e.key, i, ASPECT_RATIOS.length);
    const ratio = next === null ? undefined : ASPECT_RATIOS[next];
    if (next === null || !ratio) return;
    e.preventDefault();
    setAspectRatio(ratio);
    refs.current[next]?.focus();
  };

  return (
    <header className="glass sticky top-3 z-20 mt-3 flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-neon-cyan to-neon-magenta text-ink shadow-[0_0_24px_-6px_rgba(255,43,214,.8)]"
        >
          <Clapperboard className="h-5 w-5" />
        </span>
        <h1 className="min-w-0 leading-tight">
          <span className="sr-only">Higgsfield AI — Cinema Studio 4</span>
          <span aria-hidden className="block truncate text-base font-bold text-white sm:text-lg">
            Higgsfield AI
          </span>
          <span aria-hidden className="block truncate text-xs font-medium text-white/60 sm:text-sm">
            — Cinema Studio 4
          </span>
        </h1>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <div
          role="radiogroup"
          aria-label="Aspect ratio"
          className="flex rounded-xl border border-white/10 bg-black/30 p-1"
        >
          {ASPECT_RATIOS.map((r, i) => {
            const on = r === aspectRatio;
            return (
              <button
                key={r}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => setAspectRatio(r)}
                onKeyDown={(e) => onKey(e, i)}
                className={cn(
                  'ring-focus flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold tabular-nums transition',
                  on ? 'bg-white/15 text-neon-cyan shadow-glow-cyan' : 'text-white/60 hover:text-white',
                )}
              >
                <RatioGlyph ratio={r} />
                {r}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="btn-ghost" onClick={reset} disabled={!canReset} aria-label="Reset prompt and result">
            <RotateCcw className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Reset</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void generate()}
            disabled={!canGenerate || isGenerating}
            aria-busy={isGenerating}
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            {isGenerating ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </header>
  );
}
