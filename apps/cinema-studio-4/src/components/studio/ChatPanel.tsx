'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, MessageSquare, Send } from 'lucide-react';
import { useStudioStore, type StudioStore } from '@/store/useStudioStore';
import { findMotion } from '@/lib/data';
import { cn, uid } from '@/lib/utils';

type Message = {
  id: string;
  from: 'you' | 'director';
  text: string;
  /** A motion the co-director suggests; the message shows a button to use it. */
  motionId?: string;
};

type Rule = { test: RegExp; text: string; motionId?: string };

// Mock co-director: keyword rules first, then a reply about the current setup.
const RULES: Rule[] = [
  { test: /tense|suspense|myster|reveal|noir|slow/i, text: 'Try a slow dolly in for this scene.', motionId: 'dolly-in' },
  { test: /epic|hero|warrior|grand|sunset/i, text: 'Orbit 360 at golden hour makes a hero feel bigger than the frame.', motionId: 'orbit-360' },
  { test: /chase|action|fast|speed|race|motorcycle|car/i, text: 'Go FPV Drone — low and close, it sells the speed.', motionId: 'fpv-drone' },
  { test: /product|watch|bottle|commercial|brand|spin/i, text: 'Put it on a turntable with rim light and orbit it on an 85mm.', motionId: 'orbit-360' },
  { test: /portrait|face|close|intimate|emotion|eyes/i, text: 'An 85mm wide open with a Rack Focus between the eyes and the background.', motionId: 'rack-focus' },
  { test: /horror|scary|creep|dark|ghost/i, text: 'A slow Push In with low-key light; keep the edges of the frame dark.', motionId: 'push-in' },
  { test: /documentary|real|authentic|ugc|selfie|testimonial/i, text: 'Handheld on a 35mm keeps it honest and close to the person.', motionId: 'handheld' },
  { test: /city|landscape|establish|wide|aerial|mountain/i, text: 'Open with a Crane Up to reveal the whole place.', motionId: 'crane-up' },
  { test: /tutorial|how.?to|recipe|demo|hands/i, text: 'Keep it Static and overhead so every step reads clearly.', motionId: 'static' },
  { test: /walk|follow|run|street/i, text: 'A Tracking shot alongside them keeps the energy without shaking.', motionId: 'tracking' },
];

function reply(text: string, s: StudioStore): Omit<Message, 'id'> {
  const rule = RULES.find((r) => r.test.test(text));
  if (rule) return { from: 'director', text: rule.text, motionId: rule.motionId };
  const move = findMotion(s.selectedMotion);
  return {
    from: 'director',
    text: `With the ${s.selectedCamera} on a ${s.selectedLens}, ${move ? move.name.toLowerCase() : 'this move'} works for ${s.genre.toLowerCase()}. For more tension, try a slow dolly in.`,
    motionId: s.selectedMotion === 'dolly-in' ? undefined : 'dolly-in',
  };
}

const WELCOME: Message = {
  id: 'welcome',
  from: 'director',
  text: 'I’m your co-director. Tell me the mood or the scene and I’ll suggest a camera move.',
};

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setMotion = useStudioStore((s) => s.setMotion);
  const selectedMotion = useStudioStore((s) => s.selectedMotion);
  const inputId = useId();

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const send = () => {
    const text = draft.trim();
    if (!text || typing) return;
    setMessages((m) => [...m, { id: uid(), from: 'you', text }]);
    setDraft('');
    setTyping(true);
    timer.current = setTimeout(() => {
      setMessages((m) => [...m, { id: uid(), ...reply(text, useStudioStore.getState()) }]);
      setTyping(false);
    }, 650);
  };

  return (
    <section aria-labelledby="chat-title" className="glass flex min-h-[340px] flex-col p-4">
      <h2 id="chat-title" className="panel-title mb-3">
        <MessageSquare className="h-4 w-4 text-neon-magenta" aria-hidden />
        AI Co-Director
      </h2>

      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation with the co-director"
        className="scroll-thin -mx-1 mb-3 flex max-h-[360px] min-h-[180px] flex-1 flex-col gap-2 overflow-y-auto px-1"
      >
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const move = m.motionId ? findMotion(m.motionId) : undefined;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn('flex gap-2', m.from === 'you' && 'flex-row-reverse')}
              >
                {m.from === 'director' && (
                  <span aria-hidden className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-neon-magenta/15 text-neon-magenta">
                    <Bot className="h-4 w-4" />
                  </span>
                )}
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug',
                    m.from === 'you' ? 'rounded-br-md bg-neon-cyan/15 text-white' : 'rounded-bl-md bg-white/[0.07] text-white/90',
                  )}
                >
                  <span className="sr-only">{m.from === 'you' ? 'You: ' : 'Co-director: '}</span>
                  {m.text}
                  {move && (
                    <button
                      type="button"
                      onClick={() => setMotion(move.id)}
                      disabled={selectedMotion === move.id}
                      className="ring-focus mt-2 flex items-center gap-1 rounded-lg border border-neon-cyan/40 px-2 py-1 text-xs font-semibold text-neon-cyan transition hover:bg-neon-cyan/10 disabled:cursor-default disabled:opacity-50"
                    >
                      {selectedMotion === move.id ? `Using ${move.name}` : `Use ${move.name}`}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {typing && (
          <div className="flex items-center gap-2 text-xs text-white/50" aria-label="Co-director is typing">
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-white/50"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </span>
            thinking…
          </div>
        )}
      </div>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Message the co-director
        </label>
        <input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={300}
          placeholder="e.g. a tense rooftop chase at night"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none
            transition focus-visible:border-neon-cyan focus-visible:ring-2 focus-visible:ring-neon-cyan/50"
        />
        <button type="submit" className="btn-primary px-3" disabled={!draft.trim() || typing} aria-label="Send message">
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </section>
  );
}
