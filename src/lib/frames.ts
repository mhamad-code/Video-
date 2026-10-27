export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(r).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const PRESETS = {
  fast: { interval: 10, minGap: 15, threshold: 0.04 },
  balanced: { interval: 5, minGap: 8, threshold: 0.02 },
  detailed: { interval: 2, minGap: 3, threshold: 0.01 },
} as const;
export type PresetName = keyof typeof PRESETS;

/** Sample timestamps in [start, end), stepping by interval (seconds). */
export function sampleTimes(start: number, end: number, interval: number): number[] {
  if (!(interval > 0) || !(end > start)) return [];
  const out: number[] = [];
  const n = Math.floor((end - start) / interval + 1e-9);
  for (let i = 0; i <= n; i++) {
    const t = Math.round((start + i * interval) * 1000) / 1000;
    if (t < end) out.push(t);
  }
  return out;
}

/** Fraction of pixels whose grayscale value differs by more than pixelThreshold. */
export function changeRatio(a: ArrayLike<number>, b: ArrayLike<number>, pixelThreshold = 24): number {
  if (a.length !== b.length || a.length === 0) return 1;
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i]! - b[i]!) > pixelThreshold) diff++;
  return diff / a.length;
}

export interface Sig {
  time: number;
  sig: ArrayLike<number>;
}

/** Keep the first frame, then frames that are >= minGap later AND changed >= threshold vs the last kept one. */
export function selectDistinct(samples: Sig[], threshold: number, minGap: number): number[] {
  const kept: number[] = [];
  let last: Sig | null = null;
  samples.forEach((s, i) => {
    if (!last) {
      kept.push(i);
      last = s;
      return;
    }
    if (s.time - last.time >= minGap && changeRatio(last.sig, s.sig) >= threshold) {
      kept.push(i);
      last = s;
    }
  });
  return kept;
}
