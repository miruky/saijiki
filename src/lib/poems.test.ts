import { describe, expect, it } from 'vitest';
import {
  createStore,
  deserializePoems,
  filterPoems,
  mergePoems,
  serializePoems,
  sortByDate,
  sortByDateDesc,
  updatePoem,
  type Poem,
} from './poems';
import type { Season } from './kigo';
import { seedPoems } from './seed';

function poem(over: Partial<Poem>): Poem {
  return {
    id: 'x',
    kind: 'haiku',
    text: '枯野ゆく 旅のこころに 灯のひとつ',
    kigo: '枯野',
    date: '2026-01-10',
    memo: '',
    ...over,
  };
}

describe('deserializePoems', () => {
  it('seedPoemsと往復できる', () => {
    expect(deserializePoems(serializePoems(seedPoems()))).toEqual(seedPoems());
  });

  it('壊れたJSON・配列でないものは空', () => {
    expect(deserializePoems('{')).toEqual([]);
    expect(deserializePoems('{"a":1}')).toEqual([]);
  });

  it('形の崩れた要素だけを読み飛ばす', () => {
    const good = poem({ id: 'ok' });
    const json = JSON.stringify([
      good,
      { ...good, text: '   ' },
      { ...good, kind: 'senryu' },
      { ...good, date: '正月' },
    ]);
    expect(deserializePoems(json)).toEqual([good]);
  });
});

describe('sortByDateDesc', () => {
  it('新しい日付が先頭、同日は入力順', () => {
    const poems = [
      poem({ id: 'a', date: '2026-01-01' }),
      poem({ id: 'b', date: '2026-06-01' }),
      poem({ id: 'c', date: '2026-06-01' }),
    ];
    expect(sortByDateDesc(poems).map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('sortByDate', () => {
  it('昇順は古い日付が先頭、同日は入力順を保つ', () => {
    const poems = [
      poem({ id: 'a', date: '2026-06-01' }),
      poem({ id: 'b', date: '2026-01-01' }),
      poem({ id: 'c', date: '2026-06-01' }),
    ];
    expect(sortByDate(poems, 'asc').map((p) => p.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('filterPoems', () => {
  const seasonOf = (kigo: string): Season | undefined =>
    ({ 桜: 'spring', 蝉: 'summer', 紅葉: 'autumn' })[kigo] as Season | undefined;
  const poems = [
    poem({ id: 'h-spring', kind: 'haiku', kigo: '桜', text: '花の雲' }),
    poem({ id: 't-summer', kind: 'tanka', kigo: '蝉', text: '夏の声' }),
    poem({ id: 'h-muki', kind: 'haiku', kigo: '', text: '無季の句', memo: '街角で' }),
  ];

  it('形式で絞り込む', () => {
    const hit = filterPoems(poems, { kind: 'tanka', season: 'all', text: '' }, seasonOf);
    expect(hit.map((p) => p.id)).toEqual(['t-summer']);
  });

  it('季語の季節で絞り込む', () => {
    const hit = filterPoems(poems, { kind: 'all', season: 'spring', text: '' }, seasonOf);
    expect(hit.map((p) => p.id)).toEqual(['h-spring']);
  });

  it('無季だけを取り出す', () => {
    const hit = filterPoems(poems, { kind: 'all', season: 'muki', text: '' }, seasonOf);
    expect(hit.map((p) => p.id)).toEqual(['h-muki']);
  });

  it('本文・季語・覚え書きを横断して検索する', () => {
    expect(filterPoems(poems, { kind: 'all', season: 'all', text: '街角' }, seasonOf)).toHaveLength(
      1,
    );
    expect(filterPoems(poems, { kind: 'all', season: 'all', text: '蝉' }, seasonOf)).toHaveLength(
      1,
    );
  });
});

describe('updatePoem', () => {
  it('idの詠草だけを差し替え、他とidは保つ', () => {
    const poems = [poem({ id: 'a', memo: '' }), poem({ id: 'b', memo: '' })];
    const next = updatePoem(poems, 'a', { memo: '推敲した', text: '改作' });
    expect(next.find((p) => p.id === 'a')).toMatchObject({
      id: 'a',
      memo: '推敲した',
      text: '改作',
    });
    expect(next.find((p) => p.id === 'b')?.memo).toBe('');
  });

  it('見つからなければそのまま', () => {
    const poems = [poem({ id: 'a' })];
    expect(updatePoem(poems, 'zzz', { memo: 'x' })).toEqual(poems);
  });
});

describe('mergePoems', () => {
  it('同じidは重複させず、未知のidだけ足す', () => {
    const existing = [poem({ id: 'a', date: '2026-01-01' })];
    const incoming = [
      poem({ id: 'a', date: '2026-01-01', memo: '別端末で編集' }),
      poem({ id: 'b', date: '2026-05-01' }),
    ];
    const merged = mergePoems(existing, incoming);
    expect(merged.map((p) => p.id)).toEqual(['b', 'a']);
    // 衝突したidは既存を優先する
    expect(merged.find((p) => p.id === 'a')?.memo).toBe('');
  });

  it('取り込み後も新しい日付が先頭', () => {
    const merged = mergePoems(
      [poem({ id: 'a', date: '2025-12-31' })],
      [poem({ id: 'b', date: '2026-07-07' })],
    );
    expect(merged.map((p) => p.id)).toEqual(['b', 'a']);
  });
});

describe('createStore', () => {
  it('保存して読み戻し、空配列とnullを区別する', () => {
    const map = new Map<string, string>();
    const store = createStore({
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
    });
    expect(store.load()).toBeNull();
    store.save([]);
    expect(store.load()).toEqual([]);
    store.save(seedPoems());
    expect(store.load()).toEqual(seedPoems());
  });
});
