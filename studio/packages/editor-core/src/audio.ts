// Sound analysis on plain sample arrays (works in the browser, in a worker and in tests): waveform peaks, beats, speech spans for ducking.

// peaks: `n` values 0..1 (the loudest sample in each slice)
export function peaks(samples: Float32Array, n: number): number[] {
  const out = new Array(n).fill(0); if (!samples.length || n <= 0) return out;
  const step = samples.length / n;
  for (let i = 0; i < n; i++) { let m = 0; const a = Math.floor(i * step), b = Math.min(samples.length, Math.floor((i + 1) * step)); for (let j = a; j < b; j++) { const v = Math.abs(samples[j]); if (v > m) m = v; } out[i] = Math.round(Math.min(1, m) * 1000) / 1000; }
  return out;
}

// beats: onsets of energy rises (a moving-average threshold on the energy flux); returns seconds
export function beats(samples: Float32Array, rate: number, opts: { minGap?: number; sensitivity?: number } = {}): number[] {
  const hop = Math.round(rate / 100), win = hop * 2; const E: number[] = [];
  for (let i = 0; i + win <= samples.length; i += hop) { let s = 0; for (let j = i; j < i + win; j++) s += samples[j] * samples[j]; E.push(s / win); }
  const flux = E.map((e, i) => (i ? Math.max(0, e - E[i - 1]) : 0));
  const out: number[] = []; const gap = opts.minGap ?? 0.25, k = opts.sensitivity ?? 1.5, W = 50;
  let last = -Infinity;
  for (let i = 1; i < flux.length - 1; i++) {
    let avg = 0, c = 0; for (let j = Math.max(0, i - W); j < Math.min(flux.length, i + W); j++) { avg += flux[j]; c++; } avg /= c || 1;
    const t = (i * hop) / rate;
    if (flux[i] > avg * k && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1] && flux[i] > 1e-6 && t - last >= gap) { out.push(Math.round(t * 1000) / 1000); last = t; }
  }
  return out;
}

// loud spans (speech) — for ducking music under a voice, and later for cutting silences
export function loudSpans(samples: Float32Array, rate: number, opts: { threshold?: number; minSilence?: number; pad?: number } = {}): [number, number][] {
  const th = opts.threshold ?? 0.02, minSil = opts.minSilence ?? 0.35, pad = opts.pad ?? 0.08, hop = Math.round(rate / 50);
  const spans: [number, number][] = []; let on = -1, quiet = 0;
  for (let i = 0; i < samples.length; i += hop) {
    let s = 0; const e = Math.min(samples.length, i + hop); for (let j = i; j < e; j++) s += samples[j] * samples[j];
    const rms = Math.sqrt(s / Math.max(1, e - i)), t = i / rate;
    if (rms >= th) { if (on < 0) on = t; quiet = 0; } else if (on >= 0) { quiet += hop / rate; if (quiet >= minSil) { spans.push([Math.max(0, on - pad), t - quiet + pad]); on = -1; quiet = 0; } }
  }
  if (on >= 0) spans.push([Math.max(0, on - pad), samples.length / rate]);
  return spans.map(([a, b]) => [Math.round(a * 1000) / 1000, Math.round(b * 1000) / 1000]);
}

// the ducking gain at time t: `amount` lower while any span is speaking, with short ramps
export function duckGain(spans: [number, number][], t: number, amount: number, ramp = 0.15): number {
  let g = 1;
  for (const [a, b] of spans) {
    if (t >= a - ramp && t <= b + ramp) {
      const k = t < a ? (t - (a - ramp)) / ramp : t > b ? 1 - (t - b) / ramp : 1;
      g = Math.min(g, 1 - amount * Math.max(0, Math.min(1, k)));
    }
  }
  return g;
}
