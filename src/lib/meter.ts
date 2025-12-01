// 詠草の「よみ」(かな)から拍(モーラ)を数え、定型に合うかを調べる。
// 俳句は五・七・五の十七拍、短歌は五・七・五・七・七の三十一拍を定型とする。
// 漢字交じりの本文からは正しく数えられないため、拍は必ず「よみ」(かな)に対して数える。

import type { PoemKind } from './poems';

// 拗音をつくる小書きの仮名。直前の仮名と合わせて一拍に数えるので、それ自体は数えない。
const SMALL_KANA = new Set([
  'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゃ', 'ゅ', 'ょ', 'ゎ',
  'ァ', 'ィ', 'ゥ', 'ェ', 'ォ', 'ャ', 'ュ', 'ョ', 'ヮ',
]);

function isKanaChar(ch: string): boolean {
  const code = ch.codePointAt(0);
  if (code === undefined) return false;
  // 平仮名(U+3041–U+3096)・片仮名(U+30A1–U+30FA)・長音符(U+30FC)
  return (
    (code >= 0x3041 && code <= 0x3096) ||
    (code >= 0x30a1 && code <= 0x30fa) ||
    code === 0x30fc
  );
}

/**
 * かな文字列の拍数を数える。促音「っ」・撥音「ん」・長音「ー」は一拍、
 * 拗音の小書き(ゃゅょ等)は直前と合わせて数えるので加えない。
 * 空白・約物・漢字・ラテン文字・数字は数えない。
 */
export function countMora(reading: string): number {
  let count = 0;
  for (const ch of reading) {
    if (isKanaChar(ch) && !SMALL_KANA.has(ch)) count += 1;
  }
  return count;
}

/** 句切れごとの拍数。分かち書きの空白・改行で区切る(\sは全角空白も含む)。空の区切りは捨てる */
export function moraPerSegment(reading: string): number[] {
  return reading
    .split(/\s+/)
    .map((seg) => countMora(seg))
    .filter((n) => n > 0);
}

/** 定型の拍配分。俳句=五七五、短歌=五七五七七 */
export const METER_PATTERN: Record<PoemKind, number[]> = {
  haiku: [5, 7, 5],
  tanka: [5, 7, 5, 7, 7],
};

export interface MeterAnalysis {
  /** 句切れごとの拍数(分かち書きの空白で区切った各句) */
  segments: number[];
  /** 全体の拍数 */
  total: number;
  /** その形式の定型の総拍数(俳句17・短歌31) */
  expected: number;
  /** 総拍数が定型ちょうどか */
  fits: boolean;
  /** 定型に対する過不足(正で字余り、負で字足らず、0でちょうど) */
  diff: number;
}

/**
 * よみ(かな)を形式の定型と照らす。総拍数の一致だけを「定型」とみなし、
 * 句切れの当てはめ方(分かち書きの有無)には依存しない。
 */
export function analyzeMeter(reading: string, kind: PoemKind): MeterAnalysis {
  const segments = moraPerSegment(reading);
  const total = segments.reduce((sum, n) => sum + n, 0);
  const expected = METER_PATTERN[kind].reduce((sum, n) => sum + n, 0);
  return { segments, total, expected, fits: total === expected, diff: total - expected };
}
