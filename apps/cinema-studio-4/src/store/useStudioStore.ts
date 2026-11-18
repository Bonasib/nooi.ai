import { create } from 'zustand';
import type { AspectRatio, StudioState } from '@/types';
import { generateCinemaStudio4 } from '@/lib/higgsfield';
import { CAMERAS, ERAS, GENRES, LENSES, PROMPT_MAX, findMotion, findTemplate } from '@/lib/data';

type StudioActions = {
  setCamera: (camera: string) => void;
  setLens: (lens: string) => void;
  setAperture: (aperture: number) => void;
  setFocus: (focus: number) => void;
  setEra: (era: string) => void;
  setGenre: (genre: string) => void;
  setMotion: (motionId: string) => void;
  setTemplate: (templateId: string) => void;
  setPrompt: (prompt: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  generate: () => Promise<void>;
  reset: () => void;
};

export type StudioStore = StudioState & {
  /** Last generation error, shown in the preview; cleared on the next run. */
  error: string | null;
} & StudioActions;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const initialStudioState: StudioState & { error: string | null } = {
  selectedCamera: CAMERAS[0] ?? '',
  selectedLens: LENSES[1] ?? '',
  aperture: 2.8,
  focus: 50,
  era: ERAS[0] ?? '',
  genre: GENRES[0] ?? '',
  selectedMotion: 'static',
  selectedTemplate: null,
  prompt: '',
  aspectRatio: '16:9',
  isGenerating: false,
  resultUrl: null,
  error: null,
};

/** Bumped on every run and on reset, so a late answer from an older run is ignored. */
let runId = 0;

export const useStudioStore = create<StudioStore>()((set, get) => ({
  ...initialStudioState,

  setCamera: (selectedCamera) => set({ selectedCamera }),
  setLens: (selectedLens) => set({ selectedLens }),
  setAperture: (aperture) => set({ aperture: clamp(aperture, 1.4, 16) }),
  setFocus: (focus) => set({ focus: Math.round(clamp(focus, 0, 100)) }),
  setEra: (era) => set({ era }),
  setGenre: (genre) => set({ genre }),
  setMotion: (selectedMotion) => {
    if (findMotion(selectedMotion)) set({ selectedMotion });
  },
  setTemplate: (templateId) => {
    const template = findTemplate(templateId);
    if (!template) return;
    set({
      selectedTemplate: template.id,
      selectedMotion: template.motionPresetId,
      prompt: template.suggestedPrompt.slice(0, PROMPT_MAX),
    });
  },
  setPrompt: (prompt) => set({ prompt: prompt.slice(0, PROMPT_MAX) }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),

  generate: async () => {
    const s = get();
    if (s.isGenerating || !s.prompt.trim()) return;
    const id = ++runId;
    set({ isGenerating: true, resultUrl: null, error: null });
    try {
      const result = await generateCinemaStudio4({
        prompt: s.prompt.trim(),
        motionPreset: s.selectedMotion,
        camera: s.selectedCamera,
        lens: s.selectedLens,
        aperture: s.aperture,
        focus: s.focus,
        era: s.era,
        genre: s.genre,
        templateId: s.selectedTemplate,
        aspectRatio: s.aspectRatio,
      });
      if (id === runId) set({ resultUrl: result.videoUrl, isGenerating: false });
    } catch (e) {
      if (id === runId) {
        set({ isGenerating: false, error: e instanceof Error ? e.message : 'Generation failed. Please try again.' });
      }
    }
  },

  reset: () => {
    runId++;
    set({ prompt: '', resultUrl: null, selectedTemplate: null, isGenerating: false, error: null });
  },
}));
