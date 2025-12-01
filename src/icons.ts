// UIで使う線画アイコン。24pxグリッド・stroke=currentColorで統一し、
// 隣に必ずテキストラベルを置く前提ですべて装飾(aria-hidden)とする。

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const icons = {
  // 短冊に句を一筆したためた印
  logo: svg(
    '<path d="M8 2.5h8l-1.4 2 1.4 2v15a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z"/>' +
      '<path d="M12 8.5v8" stroke-width="1.3"/>' +
      '<path d="M12 8.5c1.6.6 1.6 2.2 0 2.8" stroke-width="1.3"/>',
  ),
  pen: svg('<path d="m16.9 3.8 3.3 3.3L8.6 18.7 4 20l1.3-4.6z"/><path d="m14.5 6.2 3.3 3.3"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/>'),
  plus: svg('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  trash: svg(
    '<path d="M4 7h16"/>' +
      '<path d="M9.5 7V5A1.5 1.5 0 0 1 11 3.5h2A1.5 1.5 0 0 1 14.5 5v2"/>' +
      '<path d="m6.5 7 .7 11.2a2 2 0 0 0 2 1.8h5.6a2 2 0 0 0 2-1.8L17.5 7"/>' +
      '<path d="M10 11v5.5"/><path d="M14 11v5.5"/>',
  ),
  download: svg('<path d="M12 3v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M5 20h14"/>'),
  upload: svg('<path d="M12 14.5V3.5"/><path d="m7.5 8 4.5-4.5 4.5 4.5"/><path d="M5 20h14"/>'),
  edit: svg('<path d="M4 20h4l10-10-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 6.5"/>'),
  close: svg('<path d="M6 6l12 12"/><path d="M18 6 6 18"/>'),
  // 並び順: 新しい順(下向き)・古い順(上向き)
  sortDesc: svg(
    '<path d="M7 4v15.5"/><path d="m3.5 16 3.5 3.5L10.5 16"/><path d="M14 6h6"/><path d="M14 11h4"/><path d="M14 16h2"/>',
  ),
  sortAsc: svg(
    '<path d="M7 20V4.5"/><path d="m3.5 8 3.5-3.5L10.5 8"/><path d="M14 6h2"/><path d="M14 11h4"/><path d="M14 16h6"/>',
  ),
  // テーマ: 自動(円を明暗で半分ずつ)
  auto: svg(
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 6a6 6 0 0 1 0 12z" fill="currentColor" stroke="none"/>',
  ),
  sun: svg(
    '<circle cx="12" cy="12" r="4.2"/>' +
      '<path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>',
  ),
  moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'),
} as const;
