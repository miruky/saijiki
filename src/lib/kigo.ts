// 季語の型と検索。季語そのものはdata/kigo.tsに置き、ここは引き方だけを持つ。

export type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'newyear';

export const SEASON_LABELS: Record<Season, string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
  newyear: '新年',
};

export type KigoCategory =
  | 'jikou'
  | 'tenmon'
  | 'chiri'
  | 'seikatsu'
  | 'gyouji'
  | 'doubutsu'
  | 'shokubutsu';

export const CATEGORY_LABELS: Record<KigoCategory, string> = {
  jikou: '時候',
  tenmon: '天文',
  chiri: '地理',
  seikatsu: '生活',
  gyouji: '行事',
  doubutsu: '動物',
  shokubutsu: '植物',
};

export interface Kigo {
  /** 見出し語 */
  word: string;
  reading: string;
  season: Season;
  category: KigoCategory;
  /** 傍題(同じ季語の別の言い方) */
  variants: string[];
  /** 季語の趣意の短い説明 */
  note: string;
}

export interface KigoQuery {
  season?: Season;
  category?: KigoCategory;
  /** 見出し語・読み・傍題に対する部分一致 */
  text?: string;
}

export function searchKigo(all: Kigo[], query: KigoQuery): Kigo[] {
  const text = query.text?.trim() ?? '';
  return all.filter((k) => {
    if (query.season !== undefined && k.season !== query.season) return false;
    if (query.category !== undefined && k.category !== query.category) return false;
    if (text !== '') {
      const haystack = [k.word, k.reading, ...k.variants].join(' ');
      if (!haystack.includes(text)) return false;
    }
    return true;
  });
}

/** 見出し語から1件ひく。見つからなければundefined */
export function findKigo(all: Kigo[], word: string): Kigo | undefined {
  return all.find((k) => k.word === word || k.variants.includes(word));
}
