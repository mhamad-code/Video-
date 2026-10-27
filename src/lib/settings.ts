import { useSyncExternalStore } from 'react';
import type { ProviderId, Settings } from './providers/types';

const KEY = 'darsai.settings.v1';
export const PROVIDER_IDS: ProviderId[] = ['gemini', 'openrouter', 'groq'];

const defaults = (): Settings => ({
  preferred: 'auto',
  persistKeys: false,
  providers: {
    gemini: { enabled: false, apiKey: '', textModel: '', visionModel: '', priority: 1 },
    openrouter: { enabled: false, apiKey: '', textModel: '', visionModel: '', priority: 2 },
    groq: { enabled: false, apiKey: '', textModel: '', visionModel: '', priority: 3 },
  },
});

function load(): Settings {
  const d = defaults();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && typeof raw === 'object') {
      d.preferred = raw.preferred ?? 'auto';
      d.persistKeys = !!raw.persistKeys;
      for (const id of PROVIDER_IDS) d.providers[id] = { ...d.providers[id], ...(raw.providers?.[id] ?? {}) };
    }
  } catch {
    /* storage unavailable or corrupt: use defaults */
  }
  return d;
}

let state: Settings = load();
const subs = new Set<() => void>();

function persist() {
  try {
    const copy: Settings = JSON.parse(JSON.stringify(state));
    // API keys live only in memory unless the user explicitly opted in.
    if (!copy.persistKeys) for (const id of PROVIDER_IDS) copy.providers[id].apiKey = '';
    localStorage.setItem(KEY, JSON.stringify(copy));
  } catch {
    /* ignore quota/private-mode errors */
  }
}

export const getSettings = () => state;
export function updateSettings(fn: (s: Settings) => Settings) {
  state = fn(state);
  persist();
  subs.forEach((f) => f());
}
export const useSettings = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    getSettings,
  );

export function clearAllKeys() {
  updateSettings((s) => {
    const n: Settings = JSON.parse(JSON.stringify(s));
    for (const id of PROVIDER_IDS) n.providers[id].apiKey = '';
    return n;
  });
}
