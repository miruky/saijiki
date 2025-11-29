// 歳時記の見出し(masthead)に使う季節ごとの言葉と写真の種。
// 写真はホットリンクのグレースケールに季節色を重ねて、原画によらず季節の地色にする。

import type { Season } from '../lib/kigo';

export interface SeasonMeta {
  /** 大見出しに置く季節名 */
  label: string;
  /** キッカーに添える読み(ローマ字) */
  romaji: string;
  /** その季節の趣意の短い説明。宣伝でなく描写にとどめる */
  phrase: string;
  /** ホットリンクする写真の種(季節ごとに別の画) */
  seed: string;
}

export const SEASON_META: Record<Season, SeasonMeta> = {
  spring: {
    label: '春',
    romaji: 'Haru',
    phrase: '霞がたなびき、草木が芽吹く。光はやわらぎ、日が少しずつ伸びてゆく。',
    seed: 'saijiki-haru-04',
  },
  summer: {
    label: '夏',
    romaji: 'Natsu',
    phrase: '緑が深まり、夕立が涼を運ぶ。生きものの声がいちばん賑わう季。',
    seed: 'saijiki-natsu-07',
  },
  autumn: {
    label: '秋',
    romaji: 'Aki',
    phrase: '空が澄んで月が冴え、実りと紅葉が色を重ねる。夜の長さに耳を澄ます。',
    seed: 'saijiki-aki-10',
  },
  winter: {
    label: '冬',
    romaji: 'Fuyu',
    phrase: '風が冴え、息が白む。枯れと静けさのなかで、遠い春の気配をさがす。',
    seed: 'saijiki-fuyu-01',
  },
  newyear: {
    label: '新年',
    romaji: 'Shinnen',
    phrase: '年があらたまる。改まった季語で、はじまりの一日を言祝ぐ。',
    seed: 'saijiki-shinnen-00',
  },
};

/** Lorem PicsumのグレースケールURL。季節色はCSSの重ねで付ける */
export function seasonImage(season: Season, width: number, height: number): string {
  const { seed } = SEASON_META[season];
  return `https://picsum.photos/seed/${seed}/${width}/${height}?grayscale`;
}
