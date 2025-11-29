import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTER, formatHash, parseFilter, parseView } from './filters';

describe('parseView', () => {
  it('既定は歳時記', () => {
    expect(parseView('')).toBe('saijiki');
    expect(parseView('#/')).toBe('saijiki');
    expect(parseView('#/?season=autumn')).toBe('saijiki');
  });

  it('#/eisou は詠草帳', () => {
    expect(parseView('#/eisou')).toBe('eisou');
  });
});

describe('parseFilter', () => {
  it('クエリから季節・分類・検索語を取り出す', () => {
    const f = parseFilter('#/?season=autumn&cat=shokubutsu&q=もみじ');
    expect(f.season).toBe('autumn');
    expect(f.category).toBe('shokubutsu');
    expect(f.query).toBe('もみじ');
  });

  it('未知の値は既定に落とす', () => {
    const f = parseFilter('#/?season=梅雨&cat=foo');
    expect(f.season).toBe(DEFAULT_FILTER.season);
    expect(f.category).toBe('');
  });

  it('検索語は長すぎると切り詰める', () => {
    const f = parseFilter(`#/?q=${'あ'.repeat(100)}`);
    expect(f.query.length).toBe(64);
  });
});

describe('formatHash', () => {
  it('既定値だけなら #/ を返す', () => {
    expect(formatHash(DEFAULT_FILTER)).toBe('#/');
  });

  it('既定でない値だけを載せる', () => {
    expect(formatHash({ season: 'winter', category: '', query: '' })).toBe('#/?season=winter');
    expect(formatHash({ season: 'spring', category: 'doubutsu', query: '' })).toBe(
      '#/?cat=doubutsu',
    );
  });

  it('検索時は季節を省く(季節をまたいで探すため)', () => {
    const hash = formatHash({ season: 'autumn', category: '', query: '蝉' });
    expect(hash).toBe(`#/?q=${encodeURIComponent('蝉')}`);
    expect(parseFilter(hash).query).toBe('蝉');
  });

  it('parseとformatが往復する', () => {
    const filter = { season: 'summer' as const, category: 'doubutsu' as const, query: '' };
    expect(parseFilter(formatHash(filter))).toEqual(filter);
  });
});
