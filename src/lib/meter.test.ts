import { describe, expect, it } from 'vitest';
import { analyzeMeter, countMora, METER_PATTERN, moraPerSegment } from './meter';

describe('countMora', () => {
  it('かな1文字を1拍に数える', () => {
    expect(countMora('はる')).toBe(2);
    expect(countMora('さくら')).toBe(3);
  });

  it('拗音の小書き(ゃゅょ等)は直前と合わせて1拍にする', () => {
    expect(countMora('きょう')).toBe(2); // きょ・う
    expect(countMora('しゃしん')).toBe(3); // しゃ・し・ん
    expect(countMora('ちゅうもん')).toBe(4); // ちゅ・う・も・ん
  });

  it('促音「っ」・撥音「ん」・長音「ー」はそれぞれ1拍に数える', () => {
    expect(countMora('がっこう')).toBe(4); // が・っ・こ・う
    expect(countMora('ほん')).toBe(2); // ほ・ん
    expect(countMora('コーヒー')).toBe(4); // コ・ー・ヒ・ー
  });

  it('片仮名も平仮名と同じく数える', () => {
    expect(countMora('セミ')).toBe(2);
    expect(countMora('シャワー')).toBe(3); // シャ・ワ・ー
  });

  it('空白・約物・ラテン文字・数字は数えない', () => {
    expect(countMora('はる の うみ')).toBe(5);
    expect(countMora('はる、うみ。')).toBe(4);
    expect(countMora('abc123')).toBe(0);
  });

  it('漢字は数えず、交じった仮名だけを数える', () => {
    expect(countMora('春夏秋冬')).toBe(0);
    expect(countMora('春の海')).toBe(1); // 「の」だけが仮名
  });

  it('空文字は0拍', () => {
    expect(countMora('')).toBe(0);
  });
});

describe('moraPerSegment', () => {
  it('分かち書きの空白で句を区切って各句の拍を返す', () => {
    expect(moraPerSegment('ふるいけや かわずとびこむ みずのおと')).toEqual([5, 7, 5]);
  });

  it('全角空白・改行・連続空白でも区切る', () => {
    expect(moraPerSegment('はる　なつ\nあき')).toEqual([2, 2, 2]);
    expect(moraPerSegment('はる   なつ')).toEqual([2, 2]);
  });

  it('空の区切りは捨てる', () => {
    expect(moraPerSegment('  はる  ')).toEqual([2]);
    expect(moraPerSegment('')).toEqual([]);
  });
});

describe('analyzeMeter', () => {
  it('俳句の定型(十七拍)ちょうどをfitsと判定する', () => {
    const a = analyzeMeter('ふるいけや かわずとびこむ みずのおと', 'haiku');
    expect(a.segments).toEqual([5, 7, 5]);
    expect(a.total).toBe(17);
    expect(a.expected).toBe(17);
    expect(a.fits).toBe(true);
    expect(a.diff).toBe(0);
  });

  it('短歌の定型(三十一拍)を判定する', () => {
    const a = analyzeMeter('みずうみの こおりのうえの つきあかり こえもなぎさに よするさざなみ', 'tanka');
    expect(a.segments).toEqual([5, 7, 5, 7, 7]);
    expect(a.total).toBe(31);
    expect(a.expected).toBe(31);
    expect(a.fits).toBe(true);
  });

  it('字余りは正のdiff、字足らずは負のdiffになる', () => {
    expect(analyzeMeter('ああ いい うう', 'haiku').diff).toBe(6 - 17); // 字足らず
    const over = analyzeMeter('あいうえおか きくけこさしすせ そたちつて', 'haiku');
    expect(over.total).toBe(6 + 8 + 5);
    expect(over.diff).toBe(over.total - 17);
    expect(over.fits).toBe(false);
  });

  it('句切れの分け方によらず総拍が合えばfits(分かち書きなしでも)', () => {
    const a = analyzeMeter('ふるいけやかわずとびこむみずのおと', 'haiku');
    expect(a.segments).toEqual([17]);
    expect(a.fits).toBe(true);
  });
});

describe('METER_PATTERN', () => {
  it('俳句は五七五、短歌は五七五七七', () => {
    expect(METER_PATTERN.haiku).toEqual([5, 7, 5]);
    expect(METER_PATTERN.tanka).toEqual([5, 7, 5, 7, 7]);
  });
});
