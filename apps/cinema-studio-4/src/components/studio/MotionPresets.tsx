'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Move3d } from 'lucide-react';
import { useStudioStore } from '@/store/useStudioStore';
import { MOTION_PRESETS } from '@/lib/data';
import { cn, getIcon } from '@/lib/utils';
import type { MotionPreset } from '@/types';

type Filter = 'all' | MotionPreset['category'];
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'camera', label: 'Camera' },
  { id: 'movement', label: 'Movement' },
  { id: 'lens', label: 'Lens' },
];

export default function MotionPresets() {
  const selectedMotion = useStudioStore((s) => s.selectedMotion);
  const setMotion = useStudioStore((s) => s.setMotion);
  const [filter, setFilter] = useState<Filter>('all');
  const list = filter === 'all' ? MOTION_PRESETS : MOTION_PRESETS.filter((m) => m.category === filter);

  return (
    <section aria-labelledby="motion-title" className="glass p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="motion-title" className="panel-title">
          <Move3d className="h-4 w-4 text-neon-cyan" aria-hidden />
          Motion Presets
        </h2>
        <span className="text-xs tabular-nums text-white/40">{MOTION_PRESETS.length} moves</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter motion presets">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'ring-focus rounded-full border px-2.5 py-1 text-xs font-medium transition',
              filter === f.id ? 'border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan' : 'border-white/10 text-white/60 hover:text-white',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2" aria-label="Motion presets">
        {list.map((m) => {
          const Icon = getIcon(m.icon);
          const on = m.id === selectedMotion;
          return (
            <li key={m.id} className="min-w-0">
              <motion.button
                type="button"
                layout="position"
                whileTap={{ scale: 0.97 }}
                aria-pressed={on}
                aria-label={`${m.name}: ${m.description}`}
                onClick={() => setMotion(m.id)}
                className={cn(
                  'ring-focus flex h-full w-full min-w-0 flex-col items-start gap-1.5 rounded-xl border p-2.5 text-left transition',
                  on
                    ? 'border-neon-cyan bg-neon-cyan/10 shadow-glow-cyan'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]',
                )}
              >
                <span
                  className={cn(
                    'grid h-8 w-8 place-items-center rounded-lg',
                    on ? 'bg-neon-cyan text-ink' : 'bg-white/10 text-white/80',
                  )}
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="w-full truncate text-sm font-semibold text-white">{m.name}</span>
                <span className="line-clamp-2 text-xs leading-snug text-white/55">{m.description}</span>
              </motion.button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
