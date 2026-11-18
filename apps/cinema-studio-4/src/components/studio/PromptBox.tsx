'use client';

import { useId } from 'react';
import { Eraser, Loader2, Sparkles } from 'lucide-react';
import { useStudioStore } from '@/store/useStudioStore';
import { DEFAULT_PROMPT_PLACEHOLDER, PROMPT_MAX, findTemplate } from '@/lib/data';
import { cn } from '@/lib/utils';

export default function PromptBox() {
  const prompt = useStudioStore((s) => s.prompt);
  const setPrompt = useStudioStore((s) => s.setPrompt);
  const isGenerating = useStudioStore((s) => s.isGenerating);
  const generate = useStudioStore((s) => s.generate);
  const selectedTemplate = useStudioStore((s) => s.selectedTemplate);
  const id = useId();
  const countId = `${id}-count`;

  const placeholder = findTemplate(selectedTemplate)?.promptPlaceholder ?? DEFAULT_PROMPT_PLACEHOLDER;
  const empty = prompt.trim().length === 0;
  const left = PROMPT_MAX - prompt.length;

  return (
    <section id="prompt" aria-labelledby={`${id}-label`} className="glass p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <label id={`${id}-label`} htmlFor={id} className="panel-title">
          <Sparkles className="h-4 w-4 text-neon-magenta" aria-hidden />
          Prompt
        </label>
        <span
          id={countId}
          className={cn(
            'text-xs font-semibold tabular-nums',
            left === 0 ? 'text-neon-magenta' : left <= 50 ? 'text-amber-300' : 'text-white/50',
          )}
        >
          {prompt.length}/{PROMPT_MAX}
        </span>
      </div>
      <textarea
        id={id}
        value={prompt}
        maxLength={PROMPT_MAX}
        rows={4}
        placeholder={placeholder}
        aria-describedby={countId}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void generate();
          }
        }}
        className="block min-h-[112px] w-full resize-y rounded-xl border border-white/10 bg-black/30 p-3 text-sm leading-relaxed text-white placeholder:text-white/35
          outline-none transition focus-visible:border-neon-cyan focus-visible:ring-2 focus-visible:ring-neon-cyan/50"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="mr-auto hidden text-xs text-white/40 sm:block">Ctrl / ⌘ + Enter to generate</p>
        <button type="button" className="btn-ghost" onClick={() => setPrompt('')} disabled={prompt.length === 0}>
          <Eraser className="h-4 w-4" aria-hidden />
          Clear
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void generate()}
          disabled={empty || isGenerating}
          aria-busy={isGenerating}
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
          {isGenerating ? 'Generating…' : 'Generate'}
        </button>
      </div>
    </section>
  );
}
