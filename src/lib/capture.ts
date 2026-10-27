import { PRESETS, sampleTimes, selectDistinct, type Sig } from './frames';

export function seek(v: HTMLVideoElement, t: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (Math.abs(v.currentTime - t) < 0.001 && v.readyState >= 2) return resolve();
    const cleanup = () => {
      v.removeEventListener('seeked', ok);
      v.removeEventListener('error', bad);
      signal?.removeEventListener('abort', abort);
    };
    const ok = () => (cleanup(), resolve());
    const bad = () => (cleanup(), reject(new Error('SEEK_FAILED')));
    const abort = () => (cleanup(), reject(new DOMException('Aborted', 'AbortError')));
    v.addEventListener('seeked', ok);
    v.addEventListener('error', bad);
    signal?.addEventListener('abort', abort);
    v.currentTime = t;
  });
}

const SIG_W = 64;
const SIG_H = 36;
const sigCanvas = () => Object.assign(document.createElement('canvas'), { width: SIG_W, height: SIG_H });

export function signature(v: HTMLVideoElement): Uint8Array {
  const c = sigCanvas();
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(v, 0, 0, SIG_W, SIG_H);
  const d = ctx.getImageData(0, 0, SIG_W, SIG_H).data;
  const g = new Uint8Array(SIG_W * SIG_H);
  for (let i = 0; i < g.length; i++) g[i] = (d[i * 4]! * 0.299 + d[i * 4 + 1]! * 0.587 + d[i * 4 + 2]! * 0.114) | 0;
  return g;
}

export function captureBlob(v: HTMLVideoElement, maxWidth = 1280): Promise<Blob> {
  const scale = Math.min(1, maxWidth / (v.videoWidth || maxWidth));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(v.videoWidth * scale));
  c.height = Math.max(1, Math.round(v.videoHeight * scale));
  c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('CAPTURE_FAILED'))), 'image/jpeg', 0.88));
}

export interface ExtractOptions {
  start: number;
  end: number;
  interval: number;
  minGap: number;
  threshold: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

/** Pass 1: sample signatures at each timestamp (real progress). Pass 2: keep distinct ones and encode only those. */
export async function extractFrames(v: HTMLVideoElement, o: ExtractOptions): Promise<{ time: number; blob: Blob }[]> {
  const times = sampleTimes(o.start, o.end, o.interval);
  const sigs: Sig[] = [];
  for (let i = 0; i < times.length; i++) {
    await seek(v, times[i]!, o.signal);
    sigs.push({ time: times[i]!, sig: signature(v) });
    o.onProgress?.(i + 1, times.length);
  }
  const keep = selectDistinct(sigs, o.threshold, o.minGap);
  const out: { time: number; blob: Blob }[] = [];
  for (const i of keep) {
    await seek(v, sigs[i]!.time, o.signal);
    out.push({ time: sigs[i]!.time, blob: await captureBlob(v) });
  }
  return out;
}

export { PRESETS };
