import { describe, expect, it } from 'vitest';
import { seasonForDate } from './season';

describe('seasonForDate', () => {
  it('月で季節を割り当てる', () => {
    expect(seasonForDate(new Date('2026-03-15'))).toBe('spring');
    expect(seasonForDate(new Date('2026-06-20'))).toBe('summer');
    expect(seasonForDate(new Date('2026-09-10'))).toBe('autumn');
    expect(seasonForDate(new Date('2026-11-30'))).toBe('winter');
    expect(seasonForDate(new Date('2026-12-25'))).toBe('winter');
  });

  it('境界の月を取り違えない', () => {
    expect(seasonForDate(new Date('2026-02-01'))).toBe('spring');
    expect(seasonForDate(new Date('2026-04-30'))).toBe('spring');
    expect(seasonForDate(new Date('2026-05-01'))).toBe('summer');
    expect(seasonForDate(new Date('2026-08-01'))).toBe('autumn');
    expect(seasonForDate(new Date('2026-10-31'))).toBe('autumn');
  });

  it('松の内(一月一〜七日)は新年、八日以降は冬', () => {
    expect(seasonForDate(new Date('2026-01-01'))).toBe('newyear');
    expect(seasonForDate(new Date('2026-01-07'))).toBe('newyear');
    expect(seasonForDate(new Date('2026-01-08'))).toBe('winter');
    expect(seasonForDate(new Date('2026-01-31'))).toBe('winter');
  });
});
