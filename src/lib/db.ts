import type { Frame, Project } from './types';
import { uid } from './blob';

const DB_NAME = 'darsai';
let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('projects', { keyPath: 'id' });
        d.createObjectStore('frames', { keyPath: 'id' }).createIndex('projectId', 'projectId');
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbp;
}

const wrap = <T,>(r: IDBRequest<T>) =>
  new Promise<T>((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

const txDone = (tx: IDBTransaction) =>
  new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });

export class StorageQuotaError extends Error {
  constructor() {
    super('QUOTA');
    this.name = 'StorageQuotaError';
  }
}
const rethrow = (e: unknown): never => {
  if (e instanceof DOMException && e.name === 'QuotaExceededError') throw new StorageQuotaError();
  throw e;
};

export async function listProjects(): Promise<Project[]> {
  const db = await open();
  return wrap(db.transaction('projects').objectStore('projects').getAll());
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await open();
  return wrap(db.transaction('projects').objectStore('projects').get(id));
}

export async function createProject(title: string, subject = ''): Promise<Project> {
  const now = Date.now();
  const p: Project = { id: uid(), title: title.trim() || 'Untitled', subject, notes: '', createdAt: now, updatedAt: now };
  await saveProject(p, false);
  return p;
}

export async function saveProject(p: Project, touch = true): Promise<Project> {
  const next = touch ? { ...p, updatedAt: Date.now() } : p;
  try {
    const db = await open();
    const tx = db.transaction('projects', 'readwrite');
    tx.objectStore('projects').put(next);
    await txDone(tx);
  } catch (e) {
    rethrow(e);
  }
  return next;
}

export async function listFrames(projectId: string): Promise<Frame[]> {
  const db = await open();
  const all = await wrap<Frame[]>(db.transaction('frames').objectStore('frames').index('projectId').getAll(projectId));
  return all.sort((a, b) => a.order - b.order);
}

export async function saveFrames(frames: Frame[]): Promise<void> {
  if (!frames.length) return;
  try {
    const db = await open();
    const tx = db.transaction('frames', 'readwrite');
    frames.forEach((f) => tx.objectStore('frames').put(f));
    await txDone(tx);
  } catch (e) {
    rethrow(e);
  }
}

export async function deleteFrame(id: string): Promise<void> {
  const db = await open();
  const tx = db.transaction('frames', 'readwrite');
  tx.objectStore('frames').delete(id);
  await txDone(tx);
}

export async function deleteProject(id: string): Promise<void> {
  const frames = await listFrames(id);
  const db = await open();
  const tx = db.transaction(['projects', 'frames'], 'readwrite');
  tx.objectStore('projects').delete(id);
  frames.forEach((f) => tx.objectStore('frames').delete(f.id));
  await txDone(tx);
}

export async function duplicateProject(id: string): Promise<Project | undefined> {
  const p = await getProject(id);
  if (!p) return undefined;
  const now = Date.now();
  const copy: Project = { ...p, id: uid(), title: `${p.title} (copy)`, createdAt: now, updatedAt: now };
  const frames = (await listFrames(id)).map((f) => ({ ...f, id: uid(), projectId: copy.id }));
  await saveProject(copy, false);
  await saveFrames(frames);
  return copy;
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  const est = await navigator.storage?.estimate?.();
  return est ? { usage: est.usage ?? 0, quota: est.quota ?? 0 } : null;
}
