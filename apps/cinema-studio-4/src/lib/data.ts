import type { AspectRatio, MotionPreset, Template } from '@/types';

export const CAMERAS: string[] = [
  'ARRI Alexa 35',
  'RED V-Raptor',
  'Sony Venice 2',
  'Blackmagic URSA Mini Pro 12K',
  'Panavision DXL2',
];

export const LENSES: string[] = ['24mm', '35mm', '50mm', '85mm', '135mm'];

export const ERAS: string[] = ['Modern', '80s', '90s', 'Film Noir', 'Victorian', 'Futuristic'];

export const GENRES: string[] = ['Cinematic', 'Commercial', 'Documentary', 'Music Video', 'Horror', 'Sci-Fi'];

/** Standard full stops from f/1.4 to f/16 — the aperture slider snaps to these. */
export const APERTURE_STOPS: number[] = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];

export const ASPECT_RATIOS: AspectRatio[] = ['16:9', '9:16', '1:1', '4:3'];

export const PROMPT_MAX = 512;

export const MOTION_PRESETS: MotionPreset[] = [
  { id: 'static', name: 'Static', icon: 'Square', description: 'No camera movement', category: 'camera' },
  { id: 'dolly-in', name: 'Dolly In', icon: 'ArrowRight', description: 'Push toward subject', category: 'movement' },
  { id: 'dolly-out', name: 'Dolly Out', icon: 'ArrowLeft', description: 'Pull away from subject', category: 'movement' },
  { id: 'pan-left', name: 'Pan Left', icon: 'ArrowLeftCircle', description: 'Rotate left', category: 'camera' },
  { id: 'pan-right', name: 'Pan Right', icon: 'ArrowRightCircle', description: 'Rotate right', category: 'camera' },
  { id: 'tilt-up', name: 'Tilt Up', icon: 'ArrowUpCircle', description: 'Tilt upward', category: 'camera' },
  { id: 'tilt-down', name: 'Tilt Down', icon: 'ArrowDownCircle', description: 'Tilt downward', category: 'camera' },
  { id: 'crane-up', name: 'Crane Up', icon: 'ArrowUp', description: 'Rise vertically', category: 'movement' },
  { id: 'crane-down', name: 'Crane Down', icon: 'ArrowDown', description: 'Lower vertically', category: 'movement' },
  { id: 'orbit-360', name: 'Orbit 360', icon: 'RotateCw', description: 'Circle around subject', category: 'movement' },
  { id: 'pov', name: 'POV', icon: 'Eye', description: 'First-person view', category: 'camera' },
  { id: 'robot-arm', name: 'Robot Arm', icon: 'Bot', description: 'Precise robotic movement', category: 'movement' },
  { id: 'fpv-drone', name: 'FPV Drone', icon: 'Plane', description: 'Fast aerial movement', category: 'movement' },
  { id: 'handheld', name: 'Handheld', icon: 'Hand', description: 'Organic shaky movement', category: 'camera' },
  { id: 'zoom-in', name: 'Zoom In', icon: 'ZoomIn', description: 'Optical zoom in', category: 'lens' },
  { id: 'zoom-out', name: 'Zoom Out', icon: 'ZoomOut', description: 'Optical zoom out', category: 'lens' },
  { id: 'rack-focus', name: 'Rack Focus', icon: 'Focus', description: 'Shift focus between planes', category: 'lens' },
  { id: 'tracking', name: 'Tracking', icon: 'MoveRight', description: 'Follow subject laterally', category: 'movement' },
  { id: 'arc', name: 'Arc', icon: 'Orbit', description: 'Curved movement around subject', category: 'movement' },
  { id: 'push-in', name: 'Push In', icon: 'ChevronRight', description: 'Slow forward push', category: 'movement' },
  { id: 'pull-out', name: 'Pull Out', icon: 'ChevronLeft', description: 'Slow backward pull', category: 'movement' },
];

export const TEMPLATES: Template[] = [
  {
    id: 'slow-push-reveal',
    name: 'Slow Push Reveal',
    icon: 'Film',
    motionPresetId: 'dolly-in',
    promptPlaceholder: 'Describe subject, setting, and one slow action…',
    suggestedPrompt:
      'A lone figure in a trench coat stands still in a foggy station. Steam rises. Neon reflects in puddles. Slow dolly forward, tense, cinematic.',
    styleTags: ['cinematic', 'moody'],
  },
  {
    id: 'orbital-hero-reveal',
    name: 'Orbital Hero Reveal',
    icon: 'Orbit',
    motionPresetId: 'orbit-360',
    promptPlaceholder: 'Describe hero and environment…',
    suggestedPrompt:
      'A warrior stands on a cliff edge at sunset. Camera orbits 360 degrees around them. Epic, heroic mood. Warm, golden hour light.',
    styleTags: ['epic', 'hero'],
  },
  {
    id: 'ugc-ad',
    name: 'UGC Ad',
    icon: 'Smartphone',
    motionPresetId: 'handheld',
    promptPlaceholder: 'Describe product and casual testimonial…',
    suggestedPrompt:
      'A young woman holds a skincare bottle near a sunny window. Handheld selfie style. She smiles and talks to camera. Bright, authentic, UGC.',
    styleTags: ['ugc', 'ad'],
  },
  {
    id: 'tutorial',
    name: 'Tutorial',
    icon: 'BookOpen',
    motionPresetId: 'static',
    promptPlaceholder: 'Describe step-by-step demonstration…',
    suggestedPrompt:
      'A chef’s hands chop vegetables on a wooden board. Static overhead shot. Clean, bright kitchen. Educational, clear.',
    styleTags: ['tutorial', 'how-to'],
  },
  {
    id: 'unboxing',
    name: 'Unboxing',
    icon: 'Package',
    motionPresetId: 'dolly-in',
    promptPlaceholder: 'Describe product and unboxing action…',
    suggestedPrompt:
      'A person opens a sleek black box on a desk. Slow dolly in. Soft studio lighting. Anticipation, premium.',
    styleTags: ['unboxing', 'product'],
  },
  {
    id: 'product-spin',
    name: 'Product Spin',
    icon: 'RefreshCw',
    motionPresetId: 'orbit-360',
    promptPlaceholder: 'Describe product on turntable…',
    suggestedPrompt:
      'A luxury watch rotates on a black turntable. Camera orbits 360 degrees. Dramatic rim lighting. High-end commercial.',
    styleTags: ['product', 'commercial'],
  },
  {
    id: 'dramatic-reveal',
    name: 'Dramatic Reveal',
    icon: 'Sunrise',
    motionPresetId: 'crane-up',
    promptPlaceholder: 'Describe reveal moment…',
    suggestedPrompt:
      'A hidden door opens in a dark wall. Crane up to reveal a glowing city beyond. Cinematic, awe-inspiring.',
    styleTags: ['dramatic', 'reveal'],
  },
  {
    id: 'action-chase',
    name: 'Action Chase',
    icon: 'Zap',
    motionPresetId: 'fpv-drone',
    promptPlaceholder: 'Describe chase scene…',
    suggestedPrompt: 'A motorcycle speeds through narrow streets. FPV drone follows closely. Fast, intense, action.',
    styleTags: ['action', 'chase'],
  },
];

export const DEFAULT_PROMPT_PLACEHOLDER =
  'Describe your shot: subject, setting, action, light and mood…';

export const findMotion = (id: string): MotionPreset | undefined => MOTION_PRESETS.find((m) => m.id === id);
export const findTemplate = (id: string | null): Template | undefined =>
  id ? TEMPLATES.find((t) => t.id === id) : undefined;
