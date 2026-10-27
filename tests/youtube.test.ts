import { describe, expect, it } from 'vitest';
import { parseYouTubeId } from '../src/lib/youtube';

describe('parseYouTubeId', () => {
  const id = 'dQw4w9WgXcQ';
  it.each([
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=30s`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}`,
    `youtu.be/${id}`,
  ])('accepts %s', (u) => expect(parseYouTubeId(u)).toBe(id));

  it.each(['', 'hello', 'https://example.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/watch?v=short', 'https://youtube.com/playlist?list=abc'])(
    'rejects %s',
    (u) => expect(parseYouTubeId(u)).toBeNull(),
  );
});
