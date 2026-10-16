'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ExternalLink, Loader2, MonitorPlay } from 'lucide-react';
import { useStudioStore } from '@/store/useStudioStore';
import { findMotion } from '@/lib/data';
import { aspectParts, formatAperture, getIcon } from '@/lib/utils';

export default function PreviewCanvas() {
  const aspectRatio = useStudioStore((s) => s.aspectRatio);
  const resultUrl = useStudioStore((s) => s.resultUrl);
  const isGenerating = useStudioStore((s) => s.isGenerating);
  const error = useStudioStore((s) => s.error);
  const selectedMotion = useStudioStore((s) => s.selectedMotion);
  const camera = useStudioStore((s) => s.selectedCamera);
  const lens = useStudioStore((s) => s.selectedLens);
  const aperture = useStudioStore((s) => s.aperture);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => setVideoFailed(false), [resultUrl]);

  const [w, h] = aspectParts(aspectRatio);
  const move = findMotion(selectedMotion);
  const MotionIcon = getIcon(move?.icon);
  const view = isGenerating ? 'loading' : resultUrl ? 'video' : 'placeholder';

  return (
    <section aria-labelledby="preview-title" className="glass p-4">
      <h2 id="preview-title" className="panel-title mb-3">
        <MonitorPlay className="h-4 w-4 text-neon-cyan" aria-hidden />
        Preview
      </h2>

      {/* The frame keeps the chosen aspect ratio and is never taller than the screen allows,
          so the whole video always fits inside it (object-contain) — nothing is cropped or spills out. */}
      <div className="grid place-items-center [--pv-max-h:52vh] lg:[--pv-max-h:60vh]">
        <div
          className="relative overflow-hidden rounded-xl border border-white/10 bg-black"
          style={{ aspectRatio: `${w} / ${h}`, width: `min(100%, calc(var(--pv-max-h) * ${w} / ${h}))` }}
        >
          {/* The layers are stacked (absolute), so they cross-fade — the spinner shows the moment Generate is pressed */}
          <AnimatePresence initial={false}>
            {view === 'video' && resultUrl && !videoFailed && (
              <motion.video
                key={resultUrl}
                src={resultUrl}
                className="absolute inset-0 h-full w-full bg-black object-contain"
                controls
                autoPlay
                muted
                loop
                playsInline
                aria-label="Generated video"
                onError={() => setVideoFailed(true)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            )}

            {view === 'video' && videoFailed && (
              <motion.div
                key="failed"
                className="absolute inset-0 grid place-items-center p-4 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="max-w-xs">
                  <AlertTriangle className="mx-auto mb-2 h-7 w-7 text-amber-300" aria-hidden />
                  <p className="text-sm text-white/80">The video is ready but couldn’t be played here.</p>
                  {resultUrl && (
                    <a
                      href={resultUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ring-focus mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-neon-cyan hover:underline"
                    >
                      Open the video <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  )}
                </div>
              </motion.div>
            )}

            {view === 'placeholder' && (
              <motion.div
                key="placeholder"
                className="absolute inset-0 grid place-items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  background:
                    'radial-gradient(120% 90% at 20% 10%, rgba(34,228,255,.28), transparent 55%), radial-gradient(110% 90% at 90% 100%, rgba(255,43,214,.3), transparent 55%), linear-gradient(135deg, #0b1020, #12081a)',
                }}
              >
                <div className="flex flex-col items-center gap-2 p-4 text-center">
                  <motion.span
                    aria-hidden
                    className="grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-white/10 text-neon-cyan shadow-glow-cyan backdrop-blur"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <MotionIcon className="h-8 w-8" />
                  </motion.span>
                  <span className="text-lg font-semibold text-white">Preview</span>
                  {error ? (
                    <span role="alert" className="text-sm text-amber-300">
                      {error}
                    </span>
                  ) : (
                    <span className="text-xs text-white/60">{move ? `${move.name} — ${move.description}` : 'Pick a motion'}</span>
                  )}
                </div>
              </motion.div>
            )}

            {view === 'loading' && (
              <motion.div
                key="loading"
                className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-neon-cyan" aria-hidden />
                  <span className="text-sm font-medium text-white/80">Rendering your shot…</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Shot details sit below the frame, never on top of the video or its controls */}
      <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-white/55">
        <span>{move?.name ?? 'Static'}</span>
        <span aria-hidden>·</span>
        <span>{camera}</span>
        <span aria-hidden>·</span>
        <span>{lens}</span>
        <span aria-hidden>·</span>
        <span>{formatAperture(aperture)}</span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">{aspectRatio}</span>
      </p>
      <p className="sr-only" aria-live="polite">
        {isGenerating ? 'Generating video.' : resultUrl ? 'Video ready.' : error ? `Error: ${error}` : ''}
      </p>
    </section>
  );
}
