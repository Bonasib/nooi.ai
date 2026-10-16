'use client';

import { motion } from 'framer-motion';
import { LayoutTemplate } from 'lucide-react';
import { useStudioStore } from '@/store/useStudioStore';
import { TEMPLATES, findMotion } from '@/lib/data';
import { cn, getIcon } from '@/lib/utils';

export default function TemplateGallery() {
  const selectedTemplate = useStudioStore((s) => s.selectedTemplate);
  const setTemplate = useStudioStore((s) => s.setTemplate);

  return (
    <section aria-labelledby="templates-title" className="glass p-4">
      <h2 id="templates-title" className="panel-title mb-3">
        <LayoutTemplate className="h-4 w-4 text-neon-magenta" aria-hidden />
        Templates
      </h2>
      <ul className="grid grid-cols-2 gap-2" aria-label="Templates">
        {TEMPLATES.map((t) => {
          const Icon = getIcon(t.icon);
          const on = t.id === selectedTemplate;
          const move = findMotion(t.motionPresetId);
          return (
            <li key={t.id} className="min-w-0">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                aria-pressed={on}
                aria-label={`${t.name} template${move ? `, ${move.name}` : ''}. Fills the motion and the prompt.`}
                onClick={() => setTemplate(t.id)}
                className={cn(
                  'ring-focus relative flex h-full w-full min-w-0 flex-col gap-2 overflow-hidden rounded-xl border p-3 text-left transition',
                  on
                    ? 'border-neon-magenta bg-neon-magenta/10 shadow-glow-magenta'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br',
                    on ? 'from-neon-magenta to-neon-cyan text-ink' : 'from-white/15 to-white/5 text-white/85',
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="text-sm font-semibold leading-tight text-white">{t.name}</span>
                {move && <span className="truncate text-[11px] text-white/50">{move.name}</span>}
                <span className="mt-auto flex flex-wrap gap-1">
                  {t.styleTags.map((tag) => (
                    <span key={tag} className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/70">
                      {tag}
                    </span>
                  ))}
                </span>
              </motion.button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
