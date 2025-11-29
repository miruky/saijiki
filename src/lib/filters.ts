// 歳時記の絞り込み状態をURLハッシュと相互変換する。共有・ブックマーク・再読込で
// 同じ画面に戻れるよう、季節・分類・検索語をハッシュのクエリに載せる。
// 表示そのものに依存しない純粋な関数として持つ。

import { CATEGORY_LABELS, SEASON_LABELS, type KigoCategory, type Season } from './kigo';

export type View = 'saijiki' | 'eisou';

export interface SaijikiFilter {
  season: Season;
  /** 空文字はすべての分類 */
  category: KigoCategory | '';
  query: string;
}

export const DEFAULT_FILTER: SaijikiFilter = {
  season: 'spring',
  category: '',
  query: '',
};

function isSeason(value: string): value is Season {
  return value in SEASON_LABELS;
}

function isCategory(value: string): value is KigoCategory {
  return value in CATEGORY_LABELS;
}

/** 先頭の#と/を取り、path部とquery部に割る */
function splitHash(hash: string): { path: string; params: URLSearchParams } {
  const body = hash.replace(/^#\/?/, '');
  const qIndex = body.indexOf('?');
  const path = qIndex === -1 ? body : body.slice(0, qIndex);
  const search = qIndex === -1 ? '' : body.slice(qIndex + 1);
  return { path, params: new URLSearchParams(search) };
}

export function parseView(hash: string): View {
  return splitHash(hash).path === 'eisou' ? 'eisou' : 'saijiki';
}

export function parseFilter(hash: string): SaijikiFilter {
  const { params } = splitHash(hash);
  const season = params.get('season') ?? '';
  const category = params.get('cat') ?? '';
  return {
    season: isSeason(season) ? season : DEFAULT_FILTER.season,
    category: isCategory(category) ? category : '',
    query: (params.get('q') ?? '').slice(0, 64),
  };
}

/** 既定値の項目は省いて短いハッシュにする */
export function formatHash(filter: SaijikiFilter): string {
  const params = new URLSearchParams();
  if (filter.query.trim() === '') {
    if (filter.season !== DEFAULT_FILTER.season) params.set('season', filter.season);
  }
  if (filter.category !== '') params.set('cat', filter.category);
  if (filter.query.trim() !== '') params.set('q', filter.query.trim());
  const query = params.toString();
  return query === '' ? '#/' : `#/?${query}`;
}
