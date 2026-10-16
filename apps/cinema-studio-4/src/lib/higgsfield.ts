import { uid } from '@/lib/utils';

export type GeneratePayload = {
  prompt: string;
  motionPreset: string;
  camera: string;
  lens: string;
  aperture: number;
  focus: number;
  era: string;
  genre: string;
  templateId: string | null;
  aspectRatio: string;
};

export type GenerateResult = {
  id: string;
  status: 'completed';
  videoUrl: string;
  thumbnailUrl: string;
};

export async function generateCinemaStudio4(payload: GeneratePayload): Promise<GenerateResult> {
  // TODO: replace with real Higgsfield API call
  console.log('Generating with payload:', payload);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return {
    id: uid(),
    status: 'completed',
    videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4',
    thumbnailUrl: '',
  };
}
