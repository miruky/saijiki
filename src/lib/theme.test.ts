import { describe, expect, it } from 'vitest';
import {
  loadTheme,
  nextTheme,
  resolveTheme,
  saveTheme,
  themeButtonLabel,
  type ThemeChoice,
} from './theme';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('nextTheme', () => {
  it('auto -> light -> dark -> auto と巡回する', () => {
    expect(nextTheme('auto')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('auto');
  });
});

describe('resolveTheme', () => {
  it('autoはOS設定に従う', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
  });

  it('明示指定はOS設定を無視する', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('loadTheme / saveTheme', () => {
  it('保存した選択を読み戻せる', () => {
    const storage = fakeStorage();
    saveTheme(storage, 'dark');
    expect(loadTheme(storage)).toBe('dark');
  });

  it('未保存や壊れた値はautoにする', () => {
    expect(loadTheme(fakeStorage())).toBe('auto');
    expect(loadTheme(fakeStorage({ 'saijiki.theme.v1': 'sepia' }))).toBe('auto');
  });
});

describe('themeButtonLabel', () => {
  it('現在と次の切替先を含む', () => {
    const label = themeButtonLabel('auto' as ThemeChoice);
    expect(label).toContain('自動');
    expect(label).toContain('昼');
  });
});
