import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import * as db from '../src/lib/db';
import { materialize, parseProjectFile } from '../src/lib/exportImport';

describe('project persistence (IndexedDB)', () => {
  it('creates, saves frames, duplicates and deletes with cascade', async () => {
    const p = await db.createProject('Lesson');
    await db.saveFrames([
      { id: 'a', projectId: p.id, order: 1, time: 5, image: new Blob(['x']), text: 'two', uncertain: false, source: 'auto' },
      { id: 'b', projectId: p.id, order: 0, time: 1, image: new Blob(['y']), text: 'one', uncertain: true, source: 'manual' },
    ]);
    expect((await db.listFrames(p.id)).map((f) => f.id)).toEqual(['b', 'a']);
    const copy = await db.duplicateProject(p.id);
    expect(copy?.id).not.toBe(p.id);
    expect(await db.listFrames(copy!.id)).toHaveLength(2);
    await db.deleteProject(p.id);
    expect(await db.getProject(p.id)).toBeUndefined();
    expect(await db.listFrames(p.id)).toHaveLength(0);
    expect(await db.listFrames(copy!.id)).toHaveLength(2);
  });
});

describe('import validation', () => {
  const valid = {
    format: 'darsai-project', version: 1,
    project: { id: 'x', title: 'T', subject: '', notes: '', createdAt: 1, updatedAt: 1 },
    frames: [{ id: 'f', projectId: 'x', order: 0, time: 3, text: 'hi', uncertain: false, source: 'auto', imageBase64: 'eA==', mime: 'image/jpeg' }],
  };
  it('accepts valid files and assigns fresh ids', () => {
    const { project, frames } = materialize(parseProjectFile(JSON.stringify(valid)));
    expect(project.id).not.toBe('x');
    expect(frames[0]!.projectId).toBe(project.id);
    expect(frames[0]!.image.size).toBe(1);
  });
  it.each([
    ['not json', 'INVALID_JSON'],
    [JSON.stringify({ ...valid, format: 'other' }), 'NOT_DARSAI_FILE'],
    [JSON.stringify({ ...valid, version: 2 }), 'UNSUPPORTED_VERSION'],
    [JSON.stringify({ ...valid, project: { title: 1 } }), 'BAD_PROJECT'],
    [JSON.stringify({ ...valid, frames: [{ time: -1 }] }), 'BAD_FRAMES'],
    [JSON.stringify({ ...valid, frames: 'x' }), 'BAD_FRAMES'],
  ])('rejects %#', (text, code) => expect(() => parseProjectFile(text)).toThrow(code));
});
