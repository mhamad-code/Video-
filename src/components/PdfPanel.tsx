import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { downloadBlob, safeName } from '../lib/download';
import type { Frame, Project } from '../lib/types';
import type { Paper, PdfMode } from '../pdf/render';

export default function PdfPanel({ project, frames }: { project: Project; frames: Frame[] }) {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<PdfMode>('detailed');
  const [paper, setPaper] = useState<Paper>('a4');
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.replaceChildren(...pages);
  }, [pages]);

  const render = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { renderPages } = await import('../pdf/render');
      const p = await renderPages(project, frames, { mode, paper, lang, dateLabel: new Date().toLocaleDateString(lang === 'ar' ? 'ar' : 'en') });
      p.forEach((c, i) => c.setAttribute('aria-label', `${t('preview')} ${i + 1}`));
      setPages(p);
      return p;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    const p = pages.length ? pages : await render();
    if (!p) return;
    try {
      const { pagesToPdf } = await import('../pdf/render');
      downloadBlob(await pagesToPdf(p, paper), `${safeName(project.title)}.pdf`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="glass">
      <div className="row">
        <label>{t('mode')}
          <select value={mode} onChange={(e) => { setMode(e.target.value as PdfMode); setPages([]); }}>
            <option value="compact">{t('mCompact')}</option>
            <option value="detailed">{t('mDetailed')}</option>
            <option value="imagesNotes">{t('mImgNotes')}</option>
            <option value="imagesOnly">{t('mImgOnly')}</option>
            <option value="textOnly">{t('mText')}</option>
          </select>
        </label>
        <label>{t('paper')}
          <select value={paper} onChange={(e) => { setPaper(e.target.value as Paper); setPages([]); }}>
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
          </select>
        </label>
        <button className="btn alt" disabled={busy} onClick={render} style={{ alignSelf: 'end' }}>{t('preview')}</button>
        <button className="btn" disabled={busy} onClick={download} style={{ alignSelf: 'end' }}>{t('downloadPdf')}</button>
      </div>
      {busy && <p role="status">{t('rendering')}</p>}
      {err && <p className="err" role="alert">{err}</p>}
      <div ref={box} className="pages" style={{ marginTop: '1rem' }} />
    </section>
  );
}
