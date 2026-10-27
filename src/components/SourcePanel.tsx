import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { PRESETS, formatTime, type PresetName } from '../lib/frames';
import { captureBlob, extractFrames } from '../lib/capture';
import { parseYouTubeId, youtubeEmbedUrl } from '../lib/youtube';
import type { Project } from '../lib/types';

export interface NewFrame {
  time: number;
  blob: Blob;
  source: 'auto' | 'manual' | 'import';
}
interface Props {
  project: Project;
  onProject: (patch: Partial<Project>) => void;
  onAdd: (f: NewFrame[]) => void;
  onDone: () => void;
}
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

export default function SourcePanel({ project, onProject, onAdd, onDone }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [now, setNow] = useState(0);
  const [preset, setPreset] = useState<PresetName>('balanced');
  const [interval, setIntervalS] = useState<number>(PRESETS.balanced.interval);
  const [minGap, setMinGap] = useState<number>(PRESETS.balanced.minGap);
  const [thr, setThr] = useState<number>(PRESETS.balanced.threshold * 100);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const [ytInput, setYtInput] = useState(project.youtubeUrl ?? '');
  const ytId = parseYouTubeId(ytInput);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => ctrl.current?.abort(), []);

  const applyPreset = (p: PresetName) => {
    setPreset(p);
    setIntervalS(PRESETS[p].interval);
    setMinGap(PRESETS[p].minGap);
    setThr(PRESETS[p].threshold * 100);
  };

  const onFile = (f: File) => {
    setError(null);
    const okType = VIDEO_TYPES.includes(f.type) || /\.(mp4|webm|ogv|mov)$/i.test(f.name);
    if (!okType) return setError(t('videoErr'));
    setUrl(URL.createObjectURL(f));
    onProject({ videoName: f.name });
  };

  const run = async () => {
    const v = videoRef.current;
    if (!v) return;
    setError(null);
    setInfo(null);
    if (!(end > start)) return setError('end > start');
    v.pause();
    ctrl.current = new AbortController();
    try {
      setProgress({ done: 0, total: 1 });
      const out = await extractFrames(v, {
        start, end, interval, minGap, threshold: thr / 100, signal: ctrl.current.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      onAdd(out.map((o) => ({ ...o, source: 'auto' as const })));
      setInfo(`${out.length} ✓`);
      if (out.length) onDone();
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') setInfo(t('cancel'));
      else setError(e instanceof Error && e.message === 'SEEK_FAILED' ? t('videoErr') : String(e));
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
      <section className="glass">
        <h2>{t('uploadVideo')}</h2>
        <input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" aria-label={t('uploadVideo')} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <p className="muted">{t('videoNote')}</p>
        {project.videoName && !url && <p className="muted">{project.videoName}</p>}
        {url && (
          <>
            <video
              ref={videoRef} src={url} controls playsInline preload="metadata"
              onLoadedMetadata={(e) => { const d = e.currentTarget.duration; setDuration(d); setStart(0); setEnd(Math.floor(d)); }}
              onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
              onError={() => setError(t('videoErr'))}
            />
            <label>
              {formatTime(now)} / {formatTime(duration)}
              <input type="range" min={0} max={duration || 0} step={0.1} value={now} aria-label="timeline" onChange={(e) => { if (videoRef.current) videoRef.current.currentTime = Number(e.target.value); }} />
            </label>
            <div className="row">
              <button className="btn ghost" onClick={() => setStart(Math.floor(now))}>{t('start')}: {formatTime(start)}</button>
              <button className="btn ghost" onClick={() => setEnd(Math.floor(now))}>{t('end')}: {formatTime(end)}</button>
              <button className="btn alt" onClick={async () => { const v = videoRef.current; if (v) { try { onAdd([{ time: v.currentTime, blob: await captureBlob(v), source: 'manual' }]); } catch { setError(t('videoErr')); } } }}>{t('capture')}</button>
            </div>
            <div className="row" style={{ marginTop: '.8rem' }}>
              <label>{t('preset')}
                <select value={preset} onChange={(e) => applyPreset(e.target.value as PresetName)}>
                  <option value="fast">{t('fast')}</option>
                  <option value="balanced">{t('balanced')}</option>
                  <option value="detailed">{t('detailed')}</option>
                </select>
              </label>
              <label>{t('interval')}<input type="number" min={0.5} step={0.5} value={interval} onChange={(e) => setIntervalS(Number(e.target.value))} style={{ width: 100 }} /></label>
              <label>{t('minGap')}<input type="number" min={0} step={1} value={minGap} onChange={(e) => setMinGap(Number(e.target.value))} style={{ width: 100 }} /></label>
              <label>{t('threshold')}<input type="number" min={0.1} max={100} step={0.5} value={thr} onChange={(e) => setThr(Number(e.target.value))} style={{ width: 100 }} /></label>
            </div>
            <div className="row" style={{ marginTop: '.8rem' }}>
              <button className="btn" disabled={!!progress} onClick={run}>{t('extract')}</button>
              {progress && <button className="btn danger" onClick={() => ctrl.current?.abort()}>{t('cancel')}</button>}
            </div>
            {progress && (
              <p role="status">{t('extracting')}: {progress.done}/{progress.total}
                <progress value={progress.done} max={progress.total} />
              </p>
            )}
          </>
        )}
        {error && <p className="err" role="alert">{error}</p>}
        {info && <p className="ok" role="status">{info}</p>}
      </section>

      <section className="glass">
        <h2>{t('ytUrl')}</h2>
        <input style={{ width: '100%' }} dir="ltr" inputMode="url" placeholder="https://youtu.be/…" value={ytInput} aria-label={t('ytUrl')}
          onChange={(e) => { setYtInput(e.target.value); const id = parseYouTubeId(e.target.value); if (id) onProject({ youtubeUrl: e.target.value }); }} />
        {ytInput && !ytId && <p className="err" role="alert">{t('ytBad')}</p>}
        {ytId && <iframe title="YouTube preview" src={youtubeEmbedUrl(ytId)} allow="encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />}
        <p className="warn">{t('ytLimit')}</p>
        <h2>{t('addImages')}</h2>
        <input type="file" accept="image/*" multiple aria-label={t('addImages')}
          onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) { onAdd(fs.map((f) => ({ time: 0, blob: f, source: 'import' as const }))); onDone(); } e.target.value = ''; }} />
      </section>
    </div>
  );
}
