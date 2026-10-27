import { ADAPTERS } from './adapters';
import { ProviderError, isRecoverable } from './errors';
import type { Capability, ProviderAdapter, Settings } from './types';

export interface AIRequest {
  system?: string;
  prompt: string;
  images?: string[];
}
export interface RunOptions {
  settings: Settings;
  adapters?: ProviderAdapter[];
  signal?: AbortSignal;
  maxRetries?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}
export class AllProvidersFailed extends Error {
  constructor(public log: string[]) {
    super('ALL_PROVIDERS_FAILED');
    this.name = 'AllProvidersFailed';
  }
}

const modelFor = (s: Settings, a: ProviderAdapter, cap: Capability) =>
  cap === 'vision' ? s.providers[a.id].visionModel : s.providers[a.id].textModel;

/** Providers that are enabled, have a key, and have a model configured for the capability — in the order they will be tried. */
export function selectProviders(settings: Settings, cap: Capability, adapters: ProviderAdapter[] = ADAPTERS): ProviderAdapter[] {
  const eligible = adapters.filter((a) => {
    const c = settings.providers[a.id];
    return c.enabled && c.apiKey.trim() !== '' && modelFor(settings, a, cap).trim() !== '';
  });
  eligible.sort((x, y) => settings.providers[x.id].priority - settings.providers[y.id].priority);
  if (settings.preferred !== 'auto') {
    const i = eligible.findIndex((a) => a.id === settings.preferred);
    if (i > 0) eligible.unshift(...eligible.splice(i, 1));
  }
  return eligible;
}

export async function runAI(req: AIRequest, cap: Capability, o: RunOptions): Promise<{ text: string; provider: string; log: string[] }> {
  const adapters = selectProviders(o.settings, cap, o.adapters);
  const log: string[] = [];
  if (adapters.length === 0) {
    log.push(`No enabled provider with a key and a ${cap} model.`);
    throw new AllProvidersFailed(log);
  }
  const retries = o.maxRetries ?? 2;
  const base = o.baseDelayMs ?? 800;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  for (const a of adapters) {
    const cfg = o.settings.providers[a.id];
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const text = await a.complete({
          apiKey: cfg.apiKey,
          model: modelFor(o.settings, a, cap),
          system: req.system,
          prompt: req.prompt,
          images: req.images,
          signal: o.signal,
        });
        log.push(`${a.name}: OK${attempt ? ` (after ${attempt} retry)` : ''}`);
        return { text, provider: a.id, log };
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e;
        const err = e instanceof ProviderError ? e : new ProviderError('unknown', e instanceof Error ? e.message : String(e));
        if (isRecoverable(err.kind) && attempt < retries) {
          const wait = base * 2 ** attempt;
          log.push(`${a.name}: ${err.kind} — retrying in ${wait}ms`);
          await sleep(wait);
          continue;
        }
        log.push(`${a.name}: ${err.kind} — ${err.message.slice(0, 120)}; falling back`);
        break; // quota/auth/unsupported (or retries exhausted) → next provider
      }
    }
  }
  throw new AllProvidersFailed(log);
}
