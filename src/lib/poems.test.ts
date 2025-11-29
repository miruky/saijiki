import { describe, expect, it } from 'vitest';
import {
  createStore,
  deserializePoems,
  mergePoems,
  serializePoems,
  sortByDateDesc,
  type Poem,
} from './poems';
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
