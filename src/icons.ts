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
