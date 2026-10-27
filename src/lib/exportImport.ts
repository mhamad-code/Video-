import type { Frame, Project } from './types';
import { base64ToBlob, blobToBase64, uid } from './blob';

export interface ExportedFrame extends Omit<Frame, 'image'> {
  imageBase64: string;
  mime: string;
}
export interface ProjectFile {
  format: 'darsai-project';
  version: 1;
  project: Project;
  frames: ExportedFrame[];
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

/** Throws Error with a code (INVALID_JSON, NOT_DARSAI_FILE, UNSUPPORTED_VERSION, BAD_PROJECT, BAD_FRAMES). */
export function parseProjectFile(text: string): ProjectFile {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('INVALID_JSON');
  }
  if (!data || data.format !== 'darsai-project') throw new Error('NOT_DARSAI_FILE');
  if (data.version !== 1) throw new Error('UNSUPPORTED_VERSION');
  const p = data.project;
  if (!p || !isStr(p.title) || !isStr(p.notes) || !isStr(p.subject)) throw new Error('BAD_PROJECT');
  if (!Array.isArray(data.frames)) throw new Error('BAD_FRAMES');
  for (const f of data.frames) {
    if (!f || !isNum(f.time) || f.time < 0 || !isStr(f.text) || !isStr(f.imageBase64) || !isStr(f.mime)) {
      throw new Error('BAD_FRAMES');
    }
  }
  return data as ProjectFile;
}

export async function exportProject(project: Project, frames: Frame[]): Promise<Blob> {
  const out: ProjectFile = {
    format: 'darsai-project',
    version: 1,
    project,
    frames: await Promise.all(
      frames.map(async ({ image, ...rest }) => ({ ...rest, imageBase64: await blobToBase64(image), mime: image.type || 'image/jpeg' })),
    ),
  };
  return new Blob([JSON.stringify(out)], { type: 'application/json' });
}

/** Builds a project + frames with fresh ids, ready for saving. */
export function materialize(file: ProjectFile): { project: Project; frames: Frame[] } {
  const now = Date.now();
  const project: Project = { ...file.project, id: uid(), createdAt: now, updatedAt: now };
  const frames: Frame[] = file.frames.map((f, i) => ({
    id: uid(),
    projectId: project.id,
    order: i,
    time: f.time,
    text: f.text,
    confidence: f.confidence,
    uncertain: !!f.uncertain,
    source: f.source ?? 'import',
    image: base64ToBlob(f.imageBase64, f.mime),
  }));
  return { project, frames };
}
