export type MotionPreset = {
  id: string;
  name: string;
  icon: string; // lucide icon name
  description: string;
  category: 'camera' | 'lens' | 'movement';
};

export type Template = {
  id: string;
  name: string;
  icon: string;
  motionPresetId: string;
  promptPlaceholder: string;
  suggestedPrompt: string;
  styleTags: string[];
};

export type StudioState = {
  selectedCamera: string;
  selectedLens: string;
  aperture: number;
  focus: number;
  era: string;
  genre: string;
  selectedMotion: string;
  selectedTemplate: string | null;
  prompt: string;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
  isGenerating: boolean;
  resultUrl: string | null;
};

export type AspectRatio = StudioState['aspectRatio'];
