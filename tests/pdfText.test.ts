import { describe, expect, it } from 'vitest';
import { containsArabic, isRtl, parseNotes, wrapText } from '../src/pdf/text';

describe('Arabic handling', () => {
  it('detects Arabic and paragraph direction by first strong letter', () => {
    expect(containsArabic('مرحبا')).toBe(true);
    expect(containsArabic('hello')).toBe(false);
    expect(isRtl('123 مرحبا x=2')).toBe(true);
    expect(isRtl('x = 2 ثم')).toBe(false);
    expect(isRtl('123')).toBe(false);
  });
});

describe('wrapText', () => {
  const m = (s: string) => s.length * 10;
  it('wraps greedily by width and keeps blank lines', () => {
    expect(wrapText('aaa bbb ccc', 70, m)).toEqual(['aaa bbb', 'ccc']);
    expect(wrapText('a\n\nb', 100, m)).toEqual(['a', '', 'b']);
    expect(wrapText('', 100, m)).toEqual(['']);
  });
  it('never drops a word that is wider than the line', () => {
    expect(wrapText('abcdefghij k', 50, m)).toEqual(['abcdefghij', 'k']);
  });
});

describe('parseNotes', () => {
  it('parses the markup', () => {
    expect(parseNotes('# A\n## B\n- c\n> d\n$$ x^2 $$\ntext\n')).toEqual([
      { kind: 'h1', text: 'A' }, { kind: 'h2', text: 'B' }, { kind: 'bullet', text: 'c' },
      { kind: 'callout', text: 'd' }, { kind: 'equation', text: 'x^2' }, { kind: 'p', text: 'text' }, { kind: 'gap', text: '' },
    ]);
  });
});
