import { describe, expect, it } from 'vitest';
import { KIGO } from '../data/kigo';
import { CATEGORY_LABELS, findKigo, searchKigo, SEASON_LABELS } from './kigo';

describe('季語データの整合性', () => {
  it('見出し語が重複しない', () => {
    const words = KIGO.map((k) => k.word);
    expect(new Set(words).size).toBe(words.length);
  });

  it('すべての項目に読みと説明がある', () => {
    for (const k of KIGO) {
      expect(k.word).not.toBe('');
      expect(k.reading).toMatch(/^[ぁ-ゖー]+$/);
      expect(k.note.length).toBeGreaterThan(5);
      expect(k.season in SEASON_LABELS).toBe(true);
      expect(k.category in CATEGORY_LABELS).toBe(true);
    }
  });

  it('五季すべてに季語がある', () => {
    for (const season of Object.keys(SEASON_LABELS)) {
      expect(KIGO.some((k) => k.season === season)).toBe(true);
    }
  });
});

describe('searchKigo', () => {
  it('季節で絞り込む', () => {
    const hits = searchKigo(KIGO, { season: 'spring' });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((k) => k.season === 'spring')).toBe(true);
  });

  it('季節と分類を重ねて絞り込む', () => {
    const hits = searchKigo(KIGO, { season: 'summer', category: 'doubutsu' });
    expect(hits.map((k) => k.word)).toContain('蝉');
    expect(hits.every((k) => k.season === 'summer' && k.category === 'doubutsu')).toBe(true);
  });

  it('読みでも傍題でも文字検索できる', () => {
    expect(searchKigo(KIGO, { text: 'こがらし' }).map((k) => k.word)).toContain('木枯');
    expect(searchKigo(KIGO, { text: '蝉時雨' }).map((k) => k.word)).toContain('蝉');
  });

  it('条件なしは全件', () => {
    expect(searchKigo(KIGO, {})).toHaveLength(KIGO.length);
  });
});

describe('findKigo', () => {
  it('見出し語と傍題のどちらからでもひける', () => {
    expect(findKigo(KIGO, '桜')?.word).toBe('桜');
    expect(findKigo(KIGO, '夜桜')?.word).toBe('桜');
    expect(findKigo(KIGO, '存在しない語')).toBeUndefined();
  });
});
