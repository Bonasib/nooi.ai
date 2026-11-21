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

// ================= (v278) noise removal for the export: a spectral gate. The noise's level per frequency is measured on the quietest
// tenth of the clip; each moment's frequencies under it (×1.6) are turned down (never below 15 %), smoothed over time and frequency.
function fft(re: Float32Array, im: Float32Array, inv: boolean) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (2 * Math.PI / len) * (inv ? 1 : -1), wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) { const u = i + k, v = u + len / 2, tr = re[v] * cr - im[v] * ci, ti = re[v] * ci + im[v] * cr;
        re[v] = re[u] - tr; im[v] = im[u] - ti; re[u] += tr; im[u] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
  }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
export function denoise278(x: Float32Array, N = 1024): Float32Array {
  const H = N / 2, bins = H + 1, win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = Math.sqrt(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const frames = Math.max(1, Math.ceil(x.length / H) + 1), mags: Float32Array[] = [], energy: number[] = [];
  const re = new Float32Array(N), im = new Float32Array(N);
  for (let f = 0; f < frames; f++) { const s = f * H - H; re.fill(0); im.fill(0); for (let i = 0; i < N; i++) { const j = s + i; re[i] = j >= 0 && j < x.length ? x[j] * win[i] : 0; }
    fft(re, im, false); const m = new Float32Array(bins); let e = 0; for (let k = 0; k < bins; k++) { m[k] = Math.hypot(re[k], im[k]); e += m[k] * m[k]; } mags.push(m); energy.push(e); }
  const order = energy.map((e, i) => [e, i]).sort((a, b) => a[0] - b[0]); const quiet = order.slice(0, Math.max(1, Math.round(frames * 0.1))).map((q) => q[1]);
  const noise = new Float32Array(bins); for (const i of quiet) for (let k = 0; k < bins; k++) noise[k] += mags[i][k] / quiet.length;
  const out = new Float32Array(x.length); let prev = new Float32Array(bins).fill(1);
  for (let f = 0; f < frames; f++) {
    const s = f * H - H; re.fill(0); im.fill(0); for (let i = 0; i < N; i++) { const j = s + i; re[i] = j >= 0 && j < x.length ? x[j] * win[i] : 0; }
    fft(re, im, false); const g = new Float32Array(bins);
    for (let k = 0; k < bins; k++) { const m = mags[f][k], t = noise[k] * 1.6; const raw = m <= 1e-9 ? 0.15 : Math.max(0.15, Math.min(1, (m - t) / m + 0.15)); g[k] = Math.max(raw, prev[k] * 0.6); }
    const gs = new Float32Array(bins); for (let k = 0; k < bins; k++) gs[k] = (g[Math.max(0, k - 1)] + g[k] + g[Math.min(bins - 1, k + 1)]) / 3; prev = gs;
    for (let k = 0; k < bins; k++) { re[k] *= gs[k]; im[k] *= gs[k]; if (k > 0 && k < H) { re[N - k] *= gs[k]; im[N - k] *= gs[k]; } }
    fft(re, im, true); for (let i = 0; i < N; i++) { const j = s + i; if (j >= 0 && j < x.length) out[j] += re[i] * win[i]; }
  }
  return out;
}
/** (v278) how far a track is lowered under the voices: its own amount, else the project's; voice tracks are never lowered */
export function duckOf(p: { ducking: { amount: number; voiceTracks: string[] } }, tr: { id: string; duck?: number | null }): number {
  if (p.ducking.voiceTracks.includes(tr.id)) return 0; return tr.duck == null ? p.ducking.amount : Math.max(0, Math.min(1, tr.duck));
}
