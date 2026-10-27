import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import * as db from '../lib/db';
import { exportProject, materialize, parseProjectFile } from '../lib/exportImport';
import { downloadBlob, safeName } from '../lib/download';
import type { Project } from '../lib/types';

const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;

export default function Dashboard() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [title, setTitle] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setProjects(await db.listProjects());
    setUsage(await db.storageEstimate().catch(() => null));
  }, []);
  useEffect(() => {
    refresh().catch(() => setMsg({ kind: 'err', text: 'IndexedDB unavailable' }));
  }, [refresh]);

  const shown = useMemo(() => {
    const list = (projects ?? []).filter((p) => (p.title + p.subject).toLowerCase().includes(q.toLowerCase()));
    return list.sort((a, b) => (sort === 'name' ? a.title.localeCompare(b.title) : b.updatedAt - a.updatedAt));
  }, [projects, q, sort]);

  const guard = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof db.StorageQuotaError ? t('quota') : String(e) });
    }
  };

  const onImport = (file: File) =>
    guard(async () => {
      try {
        const { project, frames } = materialize(parseProjectFile(await file.text()));
        await db.saveProject(project, false);
        await db.saveFrames(frames);
        await refresh();
      } catch (e) {
        if (e instanceof db.StorageQuotaError) throw e;
        setMsg({ kind: 'err', text: `${t('importErr')} (${(e as Error).message})` });
      }
    });

  return (
    <>
      <section className="glass" style={{ marginBottom: '1rem' }}>
        <h1>DarsAI</h1>
        <p>{t('tagline')}</p>
        <p className="muted">{t('privacy')}</p>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            guard(async () => {
              const p = await db.createProject(title);
              nav(`/p/${p.id}`);
            });
          }}
        >
          <label style={{ flex: '1 1 220px' }}>
            {t('lessonTitle')}
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <button className="btn" style={{ alignSelf: 'end' }}>{t('newLesson')} · {t('create')}</button>
        </form>
      </section>

      {msg && <p className={msg.kind} role="alert">{msg.text}</p>}

      <section className="glass">
        <div className="row" style={{ marginBottom: '1rem' }}>
          <input type="search" placeholder={t('search')} aria-label={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="sort" value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'name')}>
            <option value="recent">{t('sortRecent')}</option>
            <option value="name">{t('sortName')}</option>
          </select>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>{t('importP')}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
          {usage && <span className="muted">{t('storage')}: {mb(usage.usage)} / {mb(usage.quota)}</span>}
        </div>
        {projects && projects.length === 0 && <p className="muted">{t('empty')}</p>}
        <div className="grid">
          {shown.map((p) => (
            <article key={p.id} className="glass">
              <h2>{p.title}</h2>
              <p className="muted">{new Date(p.updatedAt).toLocaleString(lang === 'ar' ? 'ar' : 'en')}</p>
              <div className="row">
                <button className="btn" onClick={() => nav(`/p/${p.id}`)}>{t('open')}</button>
                <button className="btn ghost" onClick={() => { const n = prompt(t('rename'), p.title); if (n?.trim()) guard(async () => { await db.saveProject({ ...p, title: n.trim() }); await refresh(); }); }}>{t('rename')}</button>
                <button className="btn ghost" onClick={() => guard(async () => { await db.duplicateProject(p.id); await refresh(); })}>{t('duplicate')}</button>
                <button className="btn ghost" onClick={() => guard(async () => downloadBlob(await exportProject(p, await db.listFrames(p.id)), `${safeName(p.title)}.darsai.json`))}>{t('exportP')}</button>
                <button className="btn danger" onClick={() => { if (confirm(t('confirmDel'))) guard(async () => { await db.deleteProject(p.id); await refresh(); }); }}>{t('del')}</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
