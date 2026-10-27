import { describe, expect, it, vi } from 'vitest';
import { ProviderError, classifyHttp, isRecoverable } from '../src/lib/providers/errors';
import { AllProvidersFailed, runAI, selectProviders } from '../src/lib/providers/manager';
import type { ProviderAdapter, ProviderId, Settings } from '../src/lib/providers/types';

const cfg = (o: Partial<Settings['providers'][ProviderId]> = {}) => ({
  enabled: true, apiKey: 'k', textModel: 'm', visionModel: 'v', priority: 1, ...o,
});
const settings = (over: Partial<Settings> = {}, p: Partial<Record<ProviderId, ReturnType<typeof cfg>>> = {}): Settings => ({
  preferred: 'auto',
  persistKeys: false,
  providers: { gemini: cfg({ priority: 1 }), openrouter: cfg({ priority: 2 }), groq: cfg({ priority: 3 }), ...p },
  ...over,
});
const adapter = (id: ProviderId, impl: () => Promise<string>): ProviderAdapter => ({ id, name: id, complete: vi.fn(impl) });
const noSleep = () => Promise.resolve();

describe('classifyHttp', () => {
  it('classifies', () => {
    expect(classifyHttp(401)).toBe('auth');
    expect(classifyHttp(403)).toBe('auth');
    expect(classifyHttp(402)).toBe('quota');
    expect(classifyHttp(429, 'too many requests')).toBe('rate_limit');
    expect(classifyHttp(429, 'quota exceeded PerDay')).toBe('quota');
    expect(classifyHttp(404)).toBe('unsupported');
    expect(classifyHttp(400, 'model does not support image input')).toBe('unsupported');
    expect(classifyHttp(503)).toBe('server');
    expect(classifyHttp(408)).toBe('timeout');
  });
  it('only transient errors are recoverable', () => {
    expect(['rate_limit', 'network', 'timeout', 'server'].every((k) => isRecoverable(k as never))).toBe(true);
    expect(['auth', 'quota', 'unsupported', 'unknown'].some((k) => isRecoverable(k as never))).toBe(false);
  });
});

describe('selectProviders', () => {
  it('filters by enabled, key and capability model, then orders by priority', () => {
    const s = settings({}, { gemini: cfg({ visionModel: '' }), groq: cfg({ enabled: false }) });
    const ids = (cap: 'text' | 'vision') => selectProviders(s, cap, ['gemini', 'openrouter', 'groq'].map((i) => adapter(i as ProviderId, async () => ''))).map((a) => a.id);
    expect(ids('text')).toEqual(['gemini', 'openrouter']);
    expect(ids('vision')).toEqual(['openrouter']); // text-only config never receives image requests
  });
  it('puts the preferred provider first', () => {
    const s = settings({ preferred: 'groq' });
    const ids = selectProviders(s, 'text', ['gemini', 'openrouter', 'groq'].map((i) => adapter(i as ProviderId, async () => ''))).map((a) => a.id);
    expect(ids).toEqual(['groq', 'gemini', 'openrouter']);
  });
});

describe('runAI', () => {
  it('falls back immediately on quota (no retries)', async () => {
    const a = adapter('gemini', async () => { throw new ProviderError('quota', 'x'); });
    const b = adapter('openrouter', async () => 'hello');
    const r = await runAI({ prompt: 'p' }, 'text', { settings: settings(), adapters: [a, b], sleep: noSleep });
    expect(r.provider).toBe('openrouter');
    expect(a.complete).toHaveBeenCalledTimes(1);
  });
  it('retries transient errors with exponential backoff, then succeeds', async () => {
    let n = 0;
    const a = adapter('gemini', async () => { if (++n < 3) throw new ProviderError('rate_limit', 'slow'); return 'ok'; });
    const waits: number[] = [];
    const r = await runAI({ prompt: 'p' }, 'text', { settings: settings(), adapters: [a], baseDelayMs: 100, sleep: async (ms) => { waits.push(ms); } });
    expect(r.text).toBe('ok');
    expect(waits).toEqual([100, 200]);
  });
  it('falls back after retries are exhausted', async () => {
    const a = adapter('gemini', async () => { throw new ProviderError('network', 'down'); });
    const b = adapter('openrouter', async () => 'fine');
    const r = await runAI({ prompt: 'p' }, 'text', { settings: settings(), adapters: [a, b], sleep: noSleep, maxRetries: 1 });
    expect(r.provider).toBe('openrouter');
    expect(a.complete).toHaveBeenCalledTimes(2);
    expect(r.log.some((l) => l.includes('falling back'))).toBe(true);
  });
  it('throws AllProvidersFailed with a log when nothing works or nothing is configured', async () => {
    const a = adapter('gemini', async () => { throw new ProviderError('auth', 'bad key'); });
    await expect(runAI({ prompt: 'p' }, 'text', { settings: settings(), adapters: [a], sleep: noSleep })).rejects.toBeInstanceOf(AllProvidersFailed);
    const none = settings({}, { gemini: cfg({ enabled: false }), openrouter: cfg({ enabled: false }), groq: cfg({ enabled: false }) });
    await expect(runAI({ prompt: 'p' }, 'text', { settings: none, adapters: [a] })).rejects.toBeInstanceOf(AllProvidersFailed);
  });
  it('propagates user aborts instead of falling back', async () => {
    const a = adapter('gemini', async () => { throw new DOMException('Aborted', 'AbortError'); });
    const b = adapter('openrouter', async () => 'x');
    await expect(runAI({ prompt: 'p' }, 'text', { settings: settings(), adapters: [a, b], sleep: noSleep })).rejects.toThrow('Aborted');
    expect(b.complete).not.toHaveBeenCalled();
  });
});
