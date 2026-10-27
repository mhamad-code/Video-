import { describe, expect, it } from 'vitest';
import { changeRatio, formatTime, sampleTimes, selectDistinct } from '../src/lib/frames';

describe('formatTime', () => {
  it('formats mm:ss and h:mm:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(75.9)).toBe('1:15');
    expect(formatTime(3725)).toBe('1:02:05');
    expect(formatTime(-5)).toBe('0:00');
  });
});

describe('sampleTimes', () => {
  it('steps inside [start,end)', () => {
    expect(sampleTimes(0, 10, 5)).toEqual([0, 5]);
    expect(sampleTimes(2, 9, 2.5)).toEqual([2, 4.5, 7]);
  });
  it('handles invalid input', () => {
    expect(sampleTimes(5, 5, 1)).toEqual([]);
    expect(sampleTimes(0, 10, 0)).toEqual([]);
  });
});

const flat = (v: number, n = 100) => new Uint8Array(n).fill(v);
const withInk = (k: number, n = 100) => {
  const a = flat(255, n);
  for (let i = 0; i < k; i++) a[i] = 0;
  return a;
};

describe('changeRatio / selectDistinct', () => {
  it('measures changed fraction', () => {
    expect(changeRatio(flat(255), flat(255))).toBe(0);
    expect(changeRatio(flat(255), withInk(10))).toBeCloseTo(0.1);
    expect(changeRatio(flat(0, 4), flat(0, 5))).toBe(1);
  });
  it('drops near-duplicates and respects min gap', () => {
    const s = [
      { time: 0, sig: withInk(0) },
      { time: 5, sig: withInk(0) }, // identical -> dropped
      { time: 10, sig: withInk(10) }, // new writing -> kept
      { time: 12, sig: withInk(30) }, // changed but < minGap -> dropped
      { time: 20, sig: withInk(30) }, // changed vs last kept (10) and gap ok -> kept
    ];
    expect(selectDistinct(s, 0.05, 8)).toEqual([0, 2, 4]);
  });
  it('always keeps the first frame', () => {
    expect(selectDistinct([{ time: 3, sig: flat(0) }], 0.5, 100)).toEqual([0]);
    expect(selectDistinct([], 0.1, 1)).toEqual([]);
  });
});
