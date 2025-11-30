// 日付から「いまの季節」を割り出す。歳時記を開いたとき、その時季の季語が
// すぐ目に入るよう既定の季節に使う。区分は二十四節気のおおよそに合わせ、
// 二〜四月を春、五〜七月を夏、八〜十月を秋、十一〜一月を冬とする。
// 正月の松の内(一月一〜七日)だけは新年として扱う。

import type { Season } from './kigo';

export function seasonForDate(date: Date): Season {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month === 1 && day <= 7) return 'newyear';
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}
