import Header from '@/components/studio/Header';
import DirectorPanel from '@/components/studio/DirectorPanel';
import MotionPresets from '@/components/studio/MotionPresets';
import PreviewCanvas from '@/components/studio/PreviewCanvas';
import PromptBox from '@/components/studio/PromptBox';
import TemplateGallery from '@/components/studio/TemplateGallery';
import ChatPanel from '@/components/studio/ChatPanel';

export default function Page() {
  return (
    <div className="mx-auto max-w-[1600px] px-3 pb-10 sm:px-4">
      <a
        href="#prompt"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-neon-cyan focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        Skip to the prompt
      </a>
      <Header />
      <main className="mt-4 grid items-start gap-4 md:grid-cols-2 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)_minmax(280px,360px)]">
        <aside aria-label="Camera and motion" className="flex min-w-0 flex-col gap-4">
          <DirectorPanel />
          <MotionPresets />
        </aside>
        {/* On phones and tablets the preview and the prompt come first — they're what you use most */}
        <div className="order-first flex min-w-0 flex-col gap-4 md:col-span-2 lg:order-none lg:col-span-1">
          <PreviewCanvas />
          <PromptBox />
        </div>
        <aside aria-label="Templates and co-director" className="flex min-w-0 flex-col gap-4">
          <TemplateGallery />
          <ChatPanel />
        </aside>
      </main>
    </div>
  );
}
