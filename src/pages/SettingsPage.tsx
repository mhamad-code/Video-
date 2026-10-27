import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { PROVIDER_IDS, clearAllKeys, updateSettings, useSettings } from '../lib/settings';
import { ADAPTERS } from '../lib/providers/adapters';
import { ProviderError } from '../lib/providers/errors';
import type { ProviderConfig, ProviderId } from '../lib/providers/types';

export default function SettingsPage() {
  const { t } = useI18n();
  const s = useSettings();
  const [res, setRes] = useState<Partial<Record<ProviderId, { ok: boolean; text: string }>>>({});
  const [busy, setBusy] = useState<ProviderId | null>(null);

  const set = (id: ProviderId, patch: Partial<ProviderConfig>) =>
    updateSettings((p) => ({ ...p, providers: { ...p.providers, [id]: { ...p.providers[id], ...patch } } }));

  const test = async (id: ProviderId) => {
    const c = s.providers[id];
    if (!c.apiKey || !c.textModel) return setRes((r) => ({ ...r, [id]: { ok: false, text: t('needKeyModel') } }));
    setBusy(id);
    try {
      await ADAPTERS.find((a) => a.id === id)!.complete({ apiKey: c.apiKey, model: c.textModel, prompt: 'Reply with the single word OK.' });
      setRes((r) => ({ ...r, [id]: { ok: true, text: t('testOk') } }));
    } catch (e) {
      const text = e instanceof ProviderError ? `${e.kind}: ${e.message}` : String(e);
      setRes((r) => ({ ...r, [id]: { ok: false, text } }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <section className="glass" style={{ marginBottom: '1rem' }}>
        <h1>{t('settings')}</h1>
        <p className="warn">{t('keyWarn')}</p>
        <p className="muted">{t('modelHint')}</p>
        <div className="row">
          <label>
            {t('preferred')}
            <select value={s.preferred} onChange={(e) => updateSettings((p) => ({ ...p, preferred: e.target.value as typeof p.preferred }))}>
              <option value="auto">{t('auto')}</option>
              {ADAPTERS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={s.persistKeys} onChange={(e) => updateSettings((p) => ({ ...p, persistKeys: e.target.checked }))} />
            {t('persistKeys')}
          </label>
          <button className="btn danger" onClick={clearAllKeys}>{t('clearKeys')}</button>
        </div>
      </section>
      <div className="grid">
        {PROVIDER_IDS.map((id) => {
          const c = s.providers[id];
          const r = res[id];
          return (
            <section key={id} className="glass">
              <h2>{ADAPTERS.find((a) => a.id === id)!.name}</h2>
              <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <label className="check"><input type="checkbox" checked={c.enabled} onChange={(e) => set(id, { enabled: e.target.checked })} />{t('enabled')}</label>
                <label>{t('apiKey')}<input type="password" autoComplete="off" value={c.apiKey} onChange={(e) => set(id, { apiKey: e.target.value })} /></label>
                <label>{t('textModel')}<input value={c.textModel} onChange={(e) => set(id, { textModel: e.target.value.trim() })} /></label>
                <label>{t('visionModel')}<input value={c.visionModel} onChange={(e) => set(id, { visionModel: e.target.value.trim() })} /></label>
                <label>{t('priority')}<input type="number" min={1} max={9} value={c.priority} onChange={(e) => set(id, { priority: Number(e.target.value) || 1 })} /></label>
                <button className="btn alt" disabled={busy === id} onClick={() => test(id)}>{t('test')}</button>
                {r && <p className={r.ok ? 'ok' : 'err'} role="status">{r.text}</p>}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
