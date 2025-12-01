// 詠草(自作の句・歌)の型・検証・永続化。

import type { Season } from './kigo';

export type PoemKind = 'haiku' | 'tanka';

export const KIND_LABELS: Record<PoemKind, string> = {
  haiku: '俳句',
  tanka: '短歌',
};

export interface Poem {
  id: string;
  kind: PoemKind;
  /** 本文。分かち書きは空白、行替えは改行で書く */
  text: string;
  /** 詠み込んだ季語(歳時記の見出し語)。無季なら空文字 */
  kigo: string;
  /** 詠んだ日(YYYY-MM-DD) */
  date: string;
  memo: string;
  /**
   * 本文のよみ(かな)。任意。五七五の拍を数えるために使う。
   * 漢字交じりの本文からは拍を正しく数えられないため、入力されたときだけ拍を表示する。
   */
  reading?: string;
}

export function newPoemId(): string {
  return `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isPoem(value: unknown): value is Poem {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.kind === 'string' &&
    p.kind in KIND_LABELS &&
    typeof p.text === 'string' &&
    p.text.trim() !== '' &&
    typeof p.kigo === 'string' &&
    typeof p.date === 'string' &&
    DATE_RE.test(p.date) &&
    typeof p.memo === 'string' &&
    // readingは後から足した任意項目。無いか文字列なら受け入れる
    (p.reading === undefined || typeof p.reading === 'string')
  );
}

/** JSON文字列から復元する。形の崩れた要素は読み飛ばす */
export function deserializePoems(json: string): Poem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isPoem);
}

export function serializePoems(poems: Poem[]): string {
  return JSON.stringify(poems);
}

/**
 * 取り込んだ詠草を既存に統合する。同じidは既存を優先して重複させず、
 * 未知のidだけを足す。戻り値は新しい日付が先頭。
 */
export function mergePoems(existing: Poem[], incoming: Poem[]): Poem[] {
  const seen = new Set(existing.map((p) => p.id));
  const merged = [...existing];
  for (const p of incoming) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    merged.push(p);
  }
  return sortByDateDesc(merged);
}

export type SortDir = 'desc' | 'asc';

/** 日付で並べ替える。同日は入力順を保つ(安定ソート) */
export function sortByDate(poems: Poem[], dir: SortDir = 'desc'): Poem[] {
  const sign = dir === 'desc' ? 1 : -1;
  return poems
    .map((poem, index) => ({ poem, index }))
    .sort((a, b) => sign * b.poem.date.localeCompare(a.poem.date) || a.index - b.index)
    .map((k) => k.poem);
}

/** 新しい日付が先頭。保存時の正準順はこれ */
export function sortByDateDesc(poems: Poem[]): Poem[] {
  return sortByDate(poems, 'desc');
}

/** 季語の有無と季節での絞り込み条件。allはすべて、mukiは無季(季語なし) */
export interface PoemFilter {
  kind: PoemKind | 'all';
  season: Season | 'all' | 'muki';
  /** 本文・季語・覚え書きへの部分一致 */
  text: string;
}

export const DEFAULT_POEM_FILTER: PoemFilter = {
  kind: 'all',
  season: 'all',
  text: '',
};

/**
 * 詠草を絞り込む。季語から季節を引く処理は外から渡す(このモジュールは
 * 季語データに依存しない)。並びは入力のまま変えない。
 */
export function filterPoems(
  poems: Poem[],
  filter: PoemFilter,
  seasonOf: (kigo: string) => Season | undefined,
): Poem[] {
  const text = filter.text.trim();
  return poems.filter((p) => {
    if (filter.kind !== 'all' && p.kind !== filter.kind) return false;
    if (filter.season === 'muki') {
      if (p.kigo !== '') return false;
    } else if (filter.season !== 'all') {
      if (p.kigo === '' || seasonOf(p.kigo) !== filter.season) return false;
    }
    if (text !== '') {
      const haystack = [p.text, p.kigo, p.memo].join(' ');
      if (!haystack.includes(text)) return false;
    }
    return true;
  });
}

/** idの詠草だけを差し替える。idはそのまま、見つからなければ変化なし */
export function updatePoem(poems: Poem[], id: string, patch: Partial<Omit<Poem, 'id'>>): Poem[] {
  return poems.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

export interface PoemStore {
  load(): Poem[] | null;
  save(poems: Poem[]): void;
}

const STORAGE_KEY = 'saijiki.poems.v1';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createStore(storage: StorageLike): PoemStore {
  return {
    // 「保存されていない」(null)と「全件削除した」(空配列)を区別する
    load() {
      const raw = storage.getItem(STORAGE_KEY);
      return raw === null ? null : deserializePoems(raw);
    },
    save(poems) {
      storage.setItem(STORAGE_KEY, serializePoems(poems));
    },
  };
}
