import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { formatTime } from '../lib/frames';
import { LOW_CONFIDENCE, ocrBlob } from '../lib/ocr';
import { blobToBase64 } from '../lib/blob';
import { downloadBlob } from '../lib/download';
import { getSettings } from '../lib/settings';
import { AllProvidersFailed, runAI } from '../lib/providers/manager';
import type { Frame } from '../lib/types';

export const SYSTEM_PROMPT =
  'You are a careful study-notes assistant. Never invent content that is not in the provided material. Mark anything unclear with [?]. Keep the original language (Arabic stays Arabic).';
const VISION_PROMPT =
  'Transcribe all text, equations and labels visible on this board image exactly as written. Keep each language as is. Put each equation on its own line wrapped in $$...$$. Mark unreadable parts as [?]. Do not explain or add anything.';

function useUrl(blob: Blob) {
  const [u, setU] = useState('');
  useEffect(() => {
    const x = URL.createObjectURL(blob);
    setU(x);
    return () => URL.revokeObjectURL(x);
  }, [blob]);
  return u;
}

interface CardProps {
  f: Frame;
  i: number;
  n: number;
  langs: string;
  onChange: (id: string, p: Partial<Frame>) => void;
  onMove: (id: string, d: -1 | 1) => void;
  onRemove: (id: string) => void;
  onLog: (l: string[]) => void;
}

function FrameCard({ f, i, n, langs, onChange, onMove, onRemove, onLog }: CardProps) {
  const { t } = useI18n();
  const src = useUrl(f.image);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const doOcr = async () => {
    setBusy('0%');
    setErr(null);
    try {
      const r = await ocrBlob(f.image, langs, (p) => setBusy(`${Math.round(p * 100)}%`));
      onChange(f.id, { text: r.text, confidence: r.confidence, uncertain: r.confidence < LOW_CONFIDENCE || r.text === '' });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const doAi = async () => {
    if (!confirm(t('aiConsent'))) return;
    setBusy('…');
    setErr(null);
    try {
      const r = await runAI({ system: SYSTEM_PROMPT, prompt: VISION_PROMPT, images: [await blobToBase64(f.image)] }, 'vision', { settings: getSettings() });
      onLog(r.log);
      onChange(f.id, { text: r.text.trim(), uncertain: true }); // AI output is never presented as verified
    } catch (e) {
      if (e instanceof AllProvidersFailed) onLog(e.log);
      setErr(t('aiFail'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="glass frame" aria-label={`${i + 1}`}>
      <div>
        <img src={src} alt={`${formatTime(f.time)}`} />
        <div className="row" style={{ marginTop: '.5rem' }}>
          <label>{t('time')}<input type="number" min={0} step={1} value={Math.round(f.time)} style={{ width: 100 }} onChange={(e) => onChange(f.id, { time: Math.max(0, Number(e.target.value) || 0) })} /></label>
          <span className="badge">{formatTime(f.time)}</span>
          {f.confidence !== undefined && <span className="badge">{t('confidence')}: {f.confidence}%</span>}
        </div>
      </div>
      <div>
        <label>
          #{i + 1}
          <textarea value={f.text} onChange={(e) => onChange(f.id, { text: e.target.value })} dir="auto" />
        </label>
        <label className="check"><input type="checkbox" checked={f.uncertain} onChange={(e) => onChange(f.id, { uncertain: e.target.checked })} />{t('uncertain')}</label>
        <div className="row">
          <button className="btn" disabled={!!busy} onClick={doOcr}>{t('ocr')}</button>
          <button className="btn alt" disabled={!!busy} onClick={doAi}>{t('aiRead')}</button>
          <button className="btn ghost" disabled={i === 0} onClick={() => onMove(f.id, -1)} aria-label={t('up')}>↑</button>
          <button className="btn ghost" disabled={i === n - 1} onClick={() => onMove(f.id, 1)} aria-label={t('down')}>↓</button>
          <button className="btn ghost" onClick={() => downloadBlob(f.image, `frame-${i + 1}.jpg`)}>{t('download')}</button>
          <button className="btn danger" onClick={() => onRemove(f.id)}>{t('del')}</button>
        </div>
        {busy && <p role="status">{busy}</p>}
        {err && <p className="err" role="alert">{err}</p>}
      </div>
    </article>
  );
}

interface PanelProps extends Omit<CardProps, 'f' | 'i' | 'n' | 'langs'> {
  frames: Frame[];
}
export default function FramesPanel({ frames, ...rest }: PanelProps) {
  const { t } = useI18n();
  const [langs, setLangs] = useState('ara+eng');
  if (frames.length === 0) return <p className="glass muted">{t('noFrames')}</p>;
  return (
    <>
      <div className="glass row" style={{ marginBottom: '1rem' }}>
        <label>{t('ocrLang')}
          <select value={langs} onChange={(e) => setLangs(e.target.value)}>
            <option value="ara+eng">العربية + English</option>
            <option value="ara">العربية</option>
            <option value="eng">English</option>
          </select>
        </label>
        <p className="muted" style={{ flex: '1 1 260px' }}>{t('ocrNote')}</p>
      </div>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {frames.map((f, i) => <FrameCard key={f.id} f={f} i={i} n={frames.length} langs={langs} {...rest} />)}
      </div>
    </>
  );
}
