import { describe, expect, it } from 'vitest';
import { nextIndex } from './nav';

describe('nextIndex', () => {
  it('左右で隣へ動き、端で折り返す', () => {
    expect(nextIndex(0, 'ArrowRight', 5)).toBe(1);
    expect(nextIndex(4, 'ArrowRight', 5)).toBe(0);
    expect(nextIndex(0, 'ArrowLeft', 5)).toBe(4);
    expect(nextIndex(2, 'ArrowLeft', 5)).toBe(1);
  });

  it('上下も左右と同じに扱う', () => {
    expect(nextIndex(1, 'ArrowDown', 5)).toBe(2);
    expect(nextIndex(1, 'ArrowUp', 5)).toBe(0);
  });

  it('Home/Endは両端へ', () => {
    expect(nextIndex(3, 'Home', 5)).toBe(0);
    expect(nextIndex(1, 'End', 5)).toBe(4);
  });

  it('対象外のキーや空集合はnull', () => {
    expect(nextIndex(0, 'Enter', 5)).toBeNull();
    expect(nextIndex(0, 'ArrowRight', 0)).toBeNull();
  });
});
