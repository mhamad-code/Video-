import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import * as db from '../lib/db';
import { uid } from '../lib/blob';
import { getSettings } from '../lib/settings';
import { AllProvidersFailed, runAI } from '../lib/providers/manager';
import { formatTime } from '../lib/frames';
import type { Frame, Project } from '../lib/types';
import SourcePanel, { type NewFrame } from '../components/SourcePanel';
import FramesPanel, { SYSTEM_PROMPT } from '../components/FramesPanel';
import PdfPanel from '../components/PdfPanel';

type Tab = 'source' | 'frames' | 'notes' | 'pdf';

export default function Workspace() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [tab, setTab] = useState<Tab>('source');
  const [save, setSave] = useState<'saved' | 'saving' | 'error'>('saved');
  const [err, setErr] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [aiBusy, setAiBusy] = useState(false);

  const pRef = useRef<Project | null>(null);
  const fRef = useRef<Frame[]>([]);
  const dirtyF = useRef(new Set<string>());
  const dirtyP = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  pRef.current = project ?? null;
  fRef.current = frames;

  useEffect(() => {
    let live = true;
    (async () => {
      const p = await db.getProject(id);
      if (!live) return;
      setProject(p ?? null);
      if (p) setFrames(await db.listFrames(id));
    })().catch((e) => live && setErr(String(e)));
    return () => { live = false; };
  }, [id]);

  const flush = useCallback(async () => {
    const p = pRef.current;
    if (!p) return;
    const fs = fRef.current.filter((f) => dirtyF.current.has(f.id));
    const pd = dirtyP.current;
    dirtyF.current.clear();
    dirtyP.current = false;
    if (!pd && fs.length === 0) return;
    setSave('saving');
    try {
      if (pd || fs.length) await db.saveProject(p);
      await db.saveFrames(fs);
      setSave('saved');
      setErr(null);
    } catch (e) {
      fs.forEach((f) => dirtyF.current.add(f.id));
      dirtyP.current = dirtyP.current || pd;
      setSave('error');
      setErr(e instanceof db.StorageQuotaError ? t('quota') : String(e));
    }
  }, [t]);

  const schedule = useCallback(() => {
    setSave('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 700);
  }, [flush]);
  useEffect(() => () => { window.clearTimeout(timer.current); void flush(); }, [flush]);

  const updateProject = (patch: Partial<Project>) => {
    setProject((p) => (p ? { ...p, ...patch } : p));
    dirtyP.current = true;
    schedule();
  };
  const updateFrame = (fid: string, patch: Partial<Frame>) => {
    setFrames((fs) => fs.map((f) => (f.id === fid ? { ...f, ...patch } : f)));
    dirtyF.current.add(fid);
    schedule();
  };
  const addFrames = (items: NewFrame[]) => {
    setFrames((fs) => {
      const base = fs.length;
      const added: Frame[] = items.map((it, i) => ({
        id: uid(), projectId: id, order: base + i, time: it.time, image: it.blob, text: '', uncertain: false, source: it.source,
      }));
      added.forEach((f) => dirtyF.current.add(f.id));
      return [...fs, ...added];
    });
    schedule();
  };
  const move = (fid: string, d: -1 | 1) => {
    setFrames((fs) => {
      const i = fs.findIndex((f) => f.id === fid);
      const j = i + d;
      if (i < 0 || j < 0 || j >= fs.length) return fs;
      const next = [...fs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      const re = next.map((f, k) => ({ ...f, order: k }));
      re.forEach((f) => dirtyF.current.add(f.id));
      return re;
    });
    schedule();
  };
  const remove = (fid: string) => {
    if (!confirm(t('del') + '?')) return;
    setFrames((fs) => fs.filter((f) => f.id !== fid));
    db.deleteFrame(fid).catch((e) => setErr(String(e)));
  };

  const organize = async () => {
    const withText = frames.filter((f) => f.text.trim());
    if (!withText.length || !confirm(t('aiTextConsent'))) return;
    setAiBusy(true);
    try {
      const material = withText.map((f) => `[${formatTime(f.time)}]\n${f.text}`).join('\n\n');
      const prompt =
        "Organise the following timestamped board transcriptions into structured study notes using ONLY this syntax: '# ' heading, '## ' subheading, '- ' bullet, '> ' definition or key point, '$$ equation $$' for equations. Do not add facts that are not present; keep any [?] markers.\n\n" + material;
      const r = await runAI({ system: SYSTEM_PROMPT, prompt }, 'text', { settings: getSettings() });
      setLog(r.log);
      updateProject({ notes: (project?.notes ? project.notes + '\n\n' : '') + r.text.trim() });
    } catch (e) {
      if (e instanceof AllProvidersFailed) setLog(e.log);
      setErr(t('aiFail'));
    } finally {
      setAiBusy(false);
    }
  };

  if (project === undefined) return <p role="status">…</p>;
  if (project === null) return <p className="err">{t('notFound')} <Link to="/">{t('home')}</Link></p>;

  const tabs: [Tab, string][] = [['source', 'tabSource'], ['frames', 'tabFrames'], ['notes', 'tabNotes'], ['pdf', 'tabPdf']];
  return (
    <>
      <section className="glass" style={{ marginBottom: '1rem' }}>
        <div className="row">
          <label style={{ flex: '2 1 240px' }}>{t('title')}<input value={project.title} onChange={(e) => updateProject({ title: e.target.value })} /></label>
          <label style={{ flex: '1 1 160px' }}>{t('subject')}<input value={project.subject} onChange={(e) => updateProject({ subject: e.target.value })} /></label>
          <span className="badge" role="status">{t(save === 'saving' ? 'saving' : 'saved')}</span>
        </div>
        {err && <p className="err" role="alert">{err}</p>}
      </section>
      <div className="tabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className="btn ghost tab" onClick={() => setTab(k)}>{t(label)}</button>
        ))}
      </div>
      {tab === 'source' && <SourcePanel project={project} onProject={updateProject} onAdd={addFrames} onDone={() => setTab('frames')} />}
      {tab === 'frames' && <FramesPanel frames={frames} onChange={updateFrame} onMove={move} onRemove={remove} onLog={setLog} />}
      {tab === 'notes' && (
        <section className="glass">
          <p className="muted">{t('notesHelp')}</p>
          <textarea style={{ minHeight: 320 }} dir="auto" aria-label={t('tabNotes')} value={project.notes} onChange={(e) => updateProject({ notes: e.target.value })} />
          <button className="btn alt" disabled={aiBusy} onClick={organize} style={{ marginTop: '.6rem' }}>{t('organize')}</button>
        </section>
      )}
      {tab === 'pdf' && <PdfPanel project={project} frames={frames} />}
      {log.length > 0 && (
        <section className="glass" style={{ marginTop: '1rem' }}>
          <h2>{t('log')}</h2>
          <pre className="log">{log.join('\n')}</pre>
        </section>
      )}
    </>
  );
}
