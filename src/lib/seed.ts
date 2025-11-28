// 初回起動時に入れる見本の詠草。一度でも保存があれば使わない。

import type { Poem } from './poems';

export function seedPoems(): Poem[] {
  return [
    {
      id: 'seed-1',
      kind: 'haiku',
      text: '蝉時雨 やみて夕立 来たりけり',
      kigo: '蝉',
      date: '2025-08-02',
      memo: '帰り道、降り出す直前に蝉が一斉に黙った。',
    },
    {
      id: 'seed-2',
      kind: 'haiku',
      text: '初雪や 子の長靴の 揃へられ',
      kigo: '初雪',
      date: '2025-12-20',
      memo: '',
    },
    {
      id: 'seed-3',
      kind: 'tanka',
      text: '朧月 渡る木橋の 軋む音 ふりむけば灯の ひとつまたたく',
      kigo: '朧月',
      date: '2026-03-28',
      memo: '川沿いの散歩で。',
    },
  ];
}
