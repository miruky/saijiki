// 画面の描画と操作。歳時記(#/)と詠草帳(#/eisou)をハッシュで切り替える。
// 外枠(ヘッダ・本文・脚)は一度だけ組み、絞り込みや詠草の増減は本文の中だけを
// 差し替える。これでテキスト入力中もフォーカスが切れず、無用な再アニメも起きない。

import { KIGO } from './data/kigo';
import { SEASON_META, seasonImage } from './data/seasons';
import {
  CATEGORY_LABELS,
  findKigo,
  searchKigo,
  SEASON_LABELS,
  type Kigo,
  type KigoCategory,
  type Season,
} from './lib/kigo';
import { formatHash, parseFilter, parseView, type SaijikiFilter, type View } from './lib/filters';
import {
  deserializePoems,
  KIND_LABELS,
  mergePoems,
  newPoemId,
  sortByDateDesc,
  type Poem,
  type PoemKind,
  type PoemStore,
} from './lib/poems';
import {
  loadTheme,
  nextTheme,
  resolveTheme,
  saveTheme,
  themeButtonLabel,
  type ThemeChoice,
} from './lib/theme';
import { icons } from './icons';

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

function formatDateJa(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${Number(y)}年${Number(mo)}月${Number(d)}日`;
}

function media(query: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

const reduceMotion = (): boolean => media('(prefers-reduced-motion: reduce)');
const systemPrefersDark = (): boolean => media('(prefers-color-scheme: dark)');

function readTheme(): ThemeChoice {
  try {
    return loadTheme(localStorage);
  } catch {
    return 'auto';
  }
}

export interface AppDeps {
  root: HTMLElement;
  store: PoemStore;
  initialPoems: Poem[];
  today: string;
}

export function createApp({ root, store, initialPoems, today }: AppDeps): void {
  let poems = sortByDateDesc(initialPoems);
  let view: View = parseView(location.hash);
  let filter: SaijikiFilter = parseFilter(location.hash);
  /** 「この季語で詠む」で詠草帳へ持ち越す季語 */
  let composeKigo = '';
  let themeChoice = readTheme();

  /** 画面を組み替えるときに後始末する(スクロール監視やオブザーバ) */
  let disposers: Array<() => void> = [];
  let revealObserver: IntersectionObserver | null = null;

  function dispose(): void {
    for (const fn of disposers) fn();
    disposers = [];
    revealObserver?.disconnect();
    revealObserver = null;
  }

  // ---- 入場(スクロール出現) ----

  function reveal(container: HTMLElement, mode: 'enter' | 'swap'): void {
    const items = Array.from(container.querySelectorAll<HTMLElement>('.reveal'));
    if (mode === 'swap' || reduceMotion() || !('IntersectionObserver' in window)) {
      for (const el of items) el.classList.add('is-in');
      return;
    }
    revealObserver?.disconnect();
    revealObserver = new IntersectionObserver(
      (entries, obs) => {
        let shown = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.style.transitionDelay = `${Math.min(shown, 6) * 45}ms`;
          el.classList.add('is-in');
          obs.unobserve(el);
          shown += 1;
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.12 },
    );
    for (const el of items) revealObserver.observe(el);
  }

  // ---- ヘッダ ----

  function header(): string {
    const resolved = resolveTheme(themeChoice, systemPrefersDark());
    const themeIcon =
      themeChoice === 'auto' ? icons.auto : resolved === 'dark' ? icons.moon : icons.sun;
    return `
      <header class="site-header">
        <div class="bar">
          <a class="brand" href="#/">${icons.logo}<span>歳時記</span></a>
          <nav class="nav" aria-label="主要">
            <a href="#/" data-nav="saijiki" ${view === 'saijiki' ? 'aria-current="page"' : ''}>歳時記</a>
            <a href="#/eisou" data-nav="eisou" ${view === 'eisou' ? 'aria-current="page"' : ''}>詠草帳<span class="count" data-count>${poems.length}</span></a>
          </nav>
          <button type="button" class="theme-toggle" data-theme-toggle
            aria-label="${esc(themeButtonLabel(themeChoice))}">${themeIcon}</button>
        </div>
      </header>`;
  }

  function bindHeader(): void {
    root.querySelector<HTMLButtonElement>('[data-theme-toggle]')?.addEventListener('click', () => {
      themeChoice = nextTheme(themeChoice);
      applyTheme();
    });
  }

  function applyTheme(): void {
    if (themeChoice === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = themeChoice;
    try {
      saveTheme(localStorage, themeChoice);
    } catch {
      /* 保存できなくても表示は切り替える */
    }
    const btn = root.querySelector<HTMLButtonElement>('[data-theme-toggle]');
    if (btn) {
      const resolved = resolveTheme(themeChoice, systemPrefersDark());
      btn.innerHTML =
        themeChoice === 'auto' ? icons.auto : resolved === 'dark' ? icons.moon : icons.sun;
      btn.setAttribute('aria-label', themeButtonLabel(themeChoice));
    }
  }

  function syncHeaderCount(): void {
    const el = root.querySelector<HTMLElement>('[data-count]');
    if (el) el.textContent = String(poems.length);
  }

  // ---- 歳時記 ----

  function heroMarkup(): string {
    const meta = SEASON_META[filter.season];
    return `
      <section class="hero" data-season="${filter.season}">
        <div class="hero-media">
          <img class="hero-img" src="${seasonImage(filter.season, 1200, 760)}"
            alt="" width="1200" height="760" loading="eager" decoding="async" />
        </div>
        <div class="hero-text">
          <p class="kicker">歳時記 — ${meta.romaji}</p>
          <h1 class="hero-title" data-hero-title>${meta.label}</h1>
          <p class="hero-phrase" data-hero-phrase>${esc(meta.phrase)}</p>
        </div>
      </section>`;
  }

  function toolbarMarkup(): string {
    const seasonTabs = (Object.keys(SEASON_LABELS) as Season[])
      .map(
        (s) => `
          <button type="button" class="season-tab" role="tab"
            aria-selected="${s === filter.season && filter.query.trim() === ''}"
            data-season="${s}">${SEASON_LABELS[s]}</button>`,
      )
      .join('');
    const categoryOptions = (Object.keys(CATEGORY_LABELS) as KigoCategory[])
      .map(
        (c) =>
          `<option value="${c}" ${c === filter.category ? 'selected' : ''}>${CATEGORY_LABELS[c]}</option>`,
      )
      .join('');
    return `
      <div class="toolbar">
        <div class="season-tabs" role="tablist" aria-label="季節">${seasonTabs}</div>
        <div class="toolbar-filters">
          <select id="filter-category" aria-label="分類で絞り込む">
            <option value="">すべての分類</option>
            ${categoryOptions}
          </select>
          <label class="search">${icons.search}
            <input type="search" id="search" placeholder="季語・読み・傍題で探す"
              value="${esc(filter.query)}" aria-label="季語を検索" autocomplete="off" /></label>
        </div>
      </div>`;
  }

  function kigoEntry(k: Kigo, index: number): string {
    const used = poems.filter((p) => p.kigo === k.word).length;
    return `
      <li class="kigo reveal" style="--i:${index}">
        <div class="kigo-head">
          <h2 class="kigo-word">${esc(k.word)}</h2>
          <p class="kigo-reading">${esc(k.reading)}</p>
          <p class="kigo-class">
            <span class="season-dot season-${k.season}" aria-hidden="true"></span>
            ${SEASON_LABELS[k.season]}・${CATEGORY_LABELS[k.category]}
          </p>
        </div>
        <div class="kigo-body">
          <p class="kigo-note">${esc(k.note)}</p>
          ${k.variants.length > 0 ? `<p class="kigo-variants"><span class="label">傍題</span>${esc(k.variants.join('、'))}</p>` : ''}
          <div class="kigo-actions">
            ${used > 0 ? `<span class="kigo-used">この季語で${used}句</span>` : ''}
            <button type="button" class="link-button" data-compose="${esc(k.word)}">
              ${icons.pen}<span>この季語で詠む</span></button>
          </div>
        </div>
      </li>`;
  }

  function currentHits(): Kigo[] {
    const q = filter.query.trim();
    const category = filter.category === '' ? undefined : filter.category;
    // 文字検索のときは季節をまたいで探し、空なら選んだ季節の中を見る
    return q !== ''
      ? searchKigo(KIGO, { text: q, category })
      : searchKigo(KIGO, { season: filter.season, category });
  }

  function resultsMarkup(): string {
    const hits = currentHits();
    const q = filter.query.trim();
    const count =
      q !== ''
        ? `「${esc(q)}」に当てはまる季語 <span class="num">${hits.length}</span> 語`
        : `<span class="num">${hits.length}</span> 語の季語`;
    if (hits.length === 0) {
      return `
        <p class="results-count">${count}</p>
        <p class="empty">条件に当てはまる季語がありません。季節や分類を広げてみてください。</p>`;
    }
    return `
      <p class="results-count">${count}</p>
      <ul class="kigo-list">${hits.map((k, i) => kigoEntry(k, i)).join('')}</ul>`;
  }

  function updateResults(mode: 'enter' | 'swap'): void {
    const box = root.querySelector<HTMLElement>('#results');
    if (!box) return;
    box.innerHTML = resultsMarkup();
    reveal(box, mode);
    bindCompose(box);
  }

  function updateHero(): void {
    const hero = root.querySelector<HTMLElement>('.hero');
    if (!hero) return;
    const meta = SEASON_META[filter.season];
    hero.dataset.season = filter.season;
    const img = hero.querySelector<HTMLImageElement>('.hero-img');
    if (img) {
      const next = seasonImage(filter.season, 1200, 760);
      if (!img.src.endsWith(next)) img.src = next;
    }
    const title = hero.querySelector<HTMLElement>('[data-hero-title]');
    const phrase = hero.querySelector<HTMLElement>('[data-hero-phrase]');
    if (title) title.textContent = meta.label;
    if (phrase) phrase.textContent = meta.phrase;
    hero.querySelector<HTMLElement>('.kicker')!.textContent = `歳時記 — ${meta.romaji}`;
  }

  function syncSeasonTabs(): void {
    for (const el of root.querySelectorAll<HTMLElement>('[data-season]')) {
      if (el.classList.contains('season-tab')) {
        el.setAttribute(
          'aria-selected',
          String(el.dataset.season === filter.season && filter.query.trim() === ''),
        );
      }
    }
  }

  function pushFilterToHash(): void {
    history.replaceState(null, '', formatHash(filter));
  }

  function bindCompose(scope: HTMLElement): void {
    for (const el of scope.querySelectorAll<HTMLElement>('[data-compose]')) {
      el.addEventListener('click', () => {
        composeKigo = el.dataset.compose ?? '';
        location.hash = '#/eisou';
      });
    }
  }

  function mountSaijiki(main: HTMLElement): void {
    main.innerHTML = `
      <section class="view view-saijiki">
        ${heroMarkup()}
        ${toolbarMarkup()}
        <div class="results" id="results"></div>
      </section>`;

    for (const el of main.querySelectorAll<HTMLElement>('.season-tab')) {
      el.addEventListener('click', () => {
        filter = { ...filter, season: el.dataset.season as Season, query: '' };
        const search = main.querySelector<HTMLInputElement>('#search');
        if (search) search.value = '';
        syncSeasonTabs();
        updateHero();
        updateResults('enter');
        pushFilterToHash();
      });
    }
    main.querySelector('#filter-category')?.addEventListener('change', (e) => {
      filter = { ...filter, category: (e.target as HTMLSelectElement).value as KigoCategory | '' };
      updateResults('swap');
      pushFilterToHash();
    });
    const search = main.querySelector<HTMLInputElement>('#search');
    search?.addEventListener('input', () => {
      filter = { ...filter, query: search.value };
      syncSeasonTabs();
      updateResults('swap');
      pushFilterToHash();
    });

    updateResults('enter');
    bindParallax(main);
  }

  function bindParallax(main: HTMLElement): void {
    const img = main.querySelector<HTMLImageElement>('.hero-img');
    if (!img || reduceMotion()) return;
    let ticking = false;
    const onScroll = (): void => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const shift = Math.min(window.scrollY * 0.14, 64);
        img.style.transform = `scale(1.08) translate3d(0, ${shift}px, 0)`;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    disposers.push(() => window.removeEventListener('scroll', onScroll));
  }

  // ---- 詠草帳 ----

  function poemItem(p: Poem, index: number): string {
    const entry = p.kigo !== '' ? findKigo(KIGO, p.kigo) : undefined;
    const kigoTag =
      p.kigo !== ''
        ? `<span class="poem-kigo ${entry ? `season-${entry.season}` : ''}">
            ${entry ? `<span class="season-dot season-${entry.season}" aria-hidden="true"></span>` : ''}
            ${esc(p.kigo)}${entry ? `・${SEASON_LABELS[entry.season]}` : ''}</span>`
        : '<span class="poem-kigo muki">無季</span>';
    return `
      <li class="poem reveal" style="--i:${index}">
        <p class="poem-text">${esc(p.text)}</p>
        <div class="poem-meta">
          <span class="poem-kind">${KIND_LABELS[p.kind]}</span>
          ${kigoTag}
          <span class="poem-date">${formatDateJa(p.date)}</span>
          <button type="button" class="icon-button" data-del="${index}"
            aria-label="この詠草を削除">${icons.trash}</button>
        </div>
        ${p.memo !== '' ? `<p class="poem-memo">${esc(p.memo)}</p>` : ''}
      </li>`;
  }

  function poemsMarkup(): string {
    const count = `<span class="num">${poems.length}</span> 句歌`;
    if (poems.length === 0) {
      return `
        <div class="eisou-toolbar">
          <p class="results-count">${count}</p>
          ${eisouActionsMarkup()}
        </div>
        <p class="empty">詠草はまだありません。歳時記で季語をひき、最初の一句を書き留めてください。</p>`;
    }
    return `
      <div class="eisou-toolbar">
        <p class="results-count">${count}</p>
        ${eisouActionsMarkup()}
      </div>
      <ul class="poems">${poems.map((p, i) => poemItem(p, i)).join('')}</ul>`;
  }

  function eisouActionsMarkup(): string {
    return `
      <div class="eisou-actions">
        <button type="button" class="link-button" data-export ${poems.length === 0 ? 'disabled' : ''}>
          ${icons.download}<span>書き出す</span></button>
        <label class="link-button" for="import-file">${icons.upload}<span>取り込む</span></label>
        <input type="file" id="import-file" accept="application/json,.json" hidden />
      </div>`;
  }

  function updatePoems(mode: 'enter' | 'swap'): void {
    const box = root.querySelector<HTMLElement>('#poem-results');
    if (!box) return;
    box.innerHTML = poemsMarkup();
    reveal(box, mode);
    bindPoemActions(box);
  }

  function commit(mode: 'enter' | 'swap' = 'swap'): void {
    poems = sortByDateDesc(poems);
    store.save(poems);
    updatePoems(mode);
    syncHeaderCount();
  }

  function mountEisou(main: HTMLElement): void {
    const kindOptions = (Object.keys(KIND_LABELS) as PoemKind[])
      .map((k) => `<option value="${k}">${KIND_LABELS[k]}</option>`)
      .join('');
    main.innerHTML = `
      <section class="view view-eisou">
        <header class="eisou-head">
          <p class="kicker">詠草帳 — Eisou</p>
          <h1>詠んだ句歌を綴る</h1>
          <p class="lead">本文・形式・季語・日付を書き留める。保存はこの端末のブラウザの中だけで、外には送られない。</p>
        </header>
        <form class="compose" id="compose-form">
          <textarea name="text" id="compose-text" rows="2" required
            placeholder="蝉時雨 やみて夕立 来たりけり" aria-label="本文"></textarea>
          <div class="compose-row">
            <select name="kind" aria-label="形式">${kindOptions}</select>
            <input name="kigo" id="compose-kigo" list="kigo-words" value="${esc(composeKigo)}"
              placeholder="季語(無季なら空)" aria-label="季語" autocomplete="off" />
            <datalist id="kigo-words">
              ${KIGO.map((k) => `<option value="${esc(k.word)}"></option>`).join('')}
            </datalist>
            <input name="date" type="date" value="${today}" required aria-label="詠んだ日" />
            <input name="memo" placeholder="覚え書き(任意)" aria-label="覚え書き" class="grow" />
            <button type="submit" class="button primary">${icons.plus}<span>書き留める</span></button>
          </div>
        </form>
        <div class="poem-results" id="poem-results"></div>
      </section>`;

    composeKigo = '';
    main.querySelector<HTMLFormElement>('#compose-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget as HTMLFormElement);
      const read = (key: string): string => String(fd.get(key) ?? '').trim();
      const text = read('text');
      const date = read('date');
      if (text === '' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      poems.push({
        id: newPoemId(),
        kind: (read('kind') || 'haiku') as PoemKind,
        text,
        kigo: read('kigo'),
        date,
        memo: read('memo'),
      });
      (e.currentTarget as HTMLFormElement).reset();
      const dateInput = main.querySelector<HTMLInputElement>('input[name="date"]');
      if (dateInput) dateInput.value = today;
      commit('swap');
      main.querySelector<HTMLTextAreaElement>('#compose-text')?.focus();
    });

    updatePoems('enter');
  }

  function bindPoemActions(scope: HTMLElement): void {
    for (const el of scope.querySelectorAll<HTMLElement>('[data-del]')) {
      el.addEventListener('click', () => {
        poems.splice(Number(el.dataset.del), 1);
        commit('swap');
      });
    }
    scope.querySelector<HTMLButtonElement>('[data-export]')?.addEventListener('click', exportPoems);
    scope.querySelector<HTMLInputElement>('#import-file')?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void importPoems(file);
    });
  }

  function exportPoems(): void {
    const blob = new Blob([JSON.stringify(poems, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saijiki-eisou-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importPoems(file: File): Promise<void> {
    const text = await file.text();
    const incoming = deserializePoems(text);
    const before = poems.length;
    poems = mergePoems(poems, incoming);
    store.save(poems);
    updatePoems('enter');
    syncHeaderCount();
    const added = poems.length - before;
    announce(
      added > 0
        ? `${added}件の詠草を取り込みました。`
        : '取り込める新しい詠草はありませんでした(同じ内容か、形式が違います)。',
    );
  }

  let liveRegion: HTMLElement | null = null;
  function announce(message: string): void {
    if (!liveRegion) {
      liveRegion = document.createElement('p');
      liveRegion.className = 'sr-only';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      root.appendChild(liveRegion);
    }
    liveRegion.textContent = message;
  }

  // ---- 外枠と経路 ----

  function render(): void {
    dispose();
    root.innerHTML = `
      ${header()}
      <main class="site-main" id="main"></main>
      <footer class="site-footer">
        <p>歳時記と詠草帳。詠草はこの端末のブラウザにだけ保存されます。</p>
      </footer>`;
    bindHeader();
    const main = root.querySelector<HTMLElement>('#main');
    if (!main) return;
    if (view === 'saijiki') mountSaijiki(main);
    else mountEisou(main);
  }

  window.addEventListener('hashchange', () => {
    const nextView = parseView(location.hash);
    if (nextView === 'saijiki') filter = parseFilter(location.hash);
    if (nextView !== view) {
      view = nextView;
      render();
    } else if (view === 'saijiki') {
      // 同じ画面内でのハッシュ変化(戻る/進む等)は本文だけ追従させる
      syncSeasonTabs();
      const search = root.querySelector<HTMLInputElement>('#search');
      if (search) search.value = filter.query;
      const category = root.querySelector<HTMLSelectElement>('#filter-category');
      if (category) category.value = filter.category;
      updateHero();
      updateResults('swap');
    }
  });

  applyTheme();
  render();
}
