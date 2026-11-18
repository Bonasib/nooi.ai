'use client';

import { useId } from 'react';
import { Aperture, Camera, ChevronDown, Clock, Crosshair, Drama, ScanSearch } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useStudioStore } from '@/store/useStudioStore';
import { APERTURE_STOPS, CAMERAS, ERAS, GENRES, LENSES } from '@/lib/data';
import { formatAperture } from '@/lib/utils';

type SelectProps = {
  label: string;
  icon: LucideIcon;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  /** Long names (cameras) take the whole row so they are never cut off. */
  wide?: boolean;
};

function SelectField({ label, icon: Icon, value, options, onChange, wide }: SelectProps) {
  const id = useId();
  return (
    <div className={wide ? 'sm:col-span-2 lg:col-span-1 xl:col-span-2' : undefined}>
      <label htmlFor={id} className="field-label flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-neon-cyan" aria-hidden />
        {label}
      </label>
      <div className="relative">
        <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o} value={o} className="bg-[#0b0d16]">
              {o}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" aria-hidden />
      </div>
    </div>
  );
}

type SliderProps = {
  label: string;
  icon: LucideIcon;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  valueText: string;
  minLabel: string;
  maxLabel: string;
  onChange: (value: number) => void;
};

function SliderField({ label, icon: Icon, min, max, step, value, display, valueText, minLabel, maxLabel, onChange }: SliderProps) {
  const id = useId();
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="field-label mb-0 flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-neon-cyan" aria-hidden />
          {label}
        </label>
        <output htmlFor={id} className="rounded-md bg-white/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-neon-cyan">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        style={{ '--fill': fill } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="mt-1 flex justify-between text-[10px] text-white/40" aria-hidden>
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

export default function DirectorPanel() {
  const selectedCamera = useStudioStore((s) => s.selectedCamera);
  const selectedLens = useStudioStore((s) => s.selectedLens);
  const aperture = useStudioStore((s) => s.aperture);
  const focus = useStudioStore((s) => s.focus);
  const era = useStudioStore((s) => s.era);
  const genre = useStudioStore((s) => s.genre);
  const setCamera = useStudioStore((s) => s.setCamera);
  const setLens = useStudioStore((s) => s.setLens);
  const setAperture = useStudioStore((s) => s.setAperture);
  const setFocus = useStudioStore((s) => s.setFocus);
  const setEra = useStudioStore((s) => s.setEra);
  const setGenre = useStudioStore((s) => s.setGenre);

  // The slider moves over the standard f-stops; the store keeps the f-number itself.
  const stopIndex = Math.max(
    0,
    APERTURE_STOPS.reduce((best, f, i) => (Math.abs(f - aperture) < Math.abs((APERTURE_STOPS[best] ?? 0) - aperture) ? i : best), 0),
  );
  const fStop = formatAperture(aperture);
  const depth = aperture <= 2 ? 'very shallow depth of field' : aperture <= 4 ? 'shallow depth of field' : aperture <= 8 ? 'medium depth of field' : 'deep focus';

  return (
    <section aria-labelledby="director-title" className="glass p-4">
      <h2 id="director-title" className="panel-title mb-4">
        <Camera className="h-4 w-4 text-neon-cyan" aria-hidden />
        Director’s Panel
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <SelectField label="Camera" icon={Camera} value={selectedCamera} options={CAMERAS} onChange={setCamera} wide />
        <SelectField label="Lens" icon={ScanSearch} value={selectedLens} options={LENSES} onChange={setLens} />
        <SelectField label="Era" icon={Clock} value={era} options={ERAS} onChange={setEra} />
        <SelectField label="Genre" icon={Drama} value={genre} options={GENRES} onChange={setGenre} />
      </div>
      <div className="mt-5 grid gap-5">
        <SliderField
          label="Aperture"
          icon={Aperture}
          min={0}
          max={APERTURE_STOPS.length - 1}
          step={1}
          value={stopIndex}
          display={fStop}
          valueText={`${fStop}, ${depth}`}
          minLabel="f/1.4"
          maxLabel="f/16"
          onChange={(i) => setAperture(APERTURE_STOPS[i] ?? aperture)}
        />
        <SliderField
          label="Focus"
          icon={Crosshair}
          min={0}
          max={100}
          step={1}
          value={focus}
          display={`${focus}`}
          valueText={`Focus ${focus} of 100, ${focus < 34 ? 'near' : focus < 67 ? 'middle' : 'far'}`}
          minLabel="Near"
          maxLabel="Far"
          onChange={setFocus}
        />
      </div>
    </section>
  );
}
