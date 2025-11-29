// テーマの選択肢と解決。配色そのものはCSSのカスタムプロパティに持たせ、
// ここはdata-theme属性の出し入れと、永続化・巡回の純粋な計算だけを受け持つ。
// 'auto'は属性を付けず、OSのprefers-color-schemeに従う。

export type ThemeChoice = 'auto' | 'light' | 'dark';

const ORDER: ThemeChoice[] = ['auto', 'light', 'dark'];
const STORAGE_KEY = 'saijiki.theme.v1';

export const THEME_LABELS: Record<ThemeChoice, string> = {
  auto: '自動',
  light: '昼',
  dark: '夜',
};

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'auto' || value === 'light' || value === 'dark';
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadTheme(storage: StorageLike): ThemeChoice {
  const raw = storage.getItem(STORAGE_KEY);
  return isThemeChoice(raw) ? raw : 'auto';
}

export function saveTheme(storage: StorageLike, choice: ThemeChoice): void {
  storage.setItem(STORAGE_KEY, choice);
}

/** auto -> light -> dark -> auto の順に巡回する */
export function nextTheme(current: ThemeChoice): ThemeChoice {
  const i = ORDER.indexOf(current);
  return ORDER[(i + 1) % ORDER.length] ?? 'auto';
}

/** 実際に適用される明暗。autoはOS設定を見て決める */
export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): 'light' | 'dark' {
  if (choice === 'auto') return systemPrefersDark ? 'dark' : 'light';
  return choice;
}

/** 切り替えボタンの説明文。次に切り替わる先を示す */
export function themeButtonLabel(choice: ThemeChoice): string {
  return `表示テーマ: ${THEME_LABELS[choice]}(押すと${THEME_LABELS[nextTheme(choice)]}へ)`;
}
