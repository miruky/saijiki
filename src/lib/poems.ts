// 詠草(自作の句・歌)の型・検証・永続化。

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
    typeof p.memo === 'string'
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

/** 新しい日付が先頭。同日は入力順を保つ */
export function sortByDateDesc(poems: Poem[]): Poem[] {
  return poems
    .map((poem, index) => ({ poem, index }))
    .sort((a, b) => b.poem.date.localeCompare(a.poem.date) || a.index - b.index)
    .map((k) => k.poem);
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
