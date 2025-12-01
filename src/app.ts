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
import { nextIndex } from './lib/nav';
import { analyzeMeter } from './lib/meter';
import {
  DEFAULT_POEM_FILTER,
  deserializePoems,
  filterPoems,
  KIND_LABELS,
  mergePoems,
  newPoemId,
  sortByDate,
  sortByDateDesc,
  updatePoem,
  type Poem,
  type PoemFilter,
  type PoemKind,
  type PoemStore,
  type SortDir,
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

/** よみ(かな)から五七五の拍を組んだ短い表示。よみが空なら空文字 */
function meterMarkup(reading: string, kind: PoemKind): string {
  if (reading.trim() === '') return '';
  const a = analyzeMeter(reading, kind);
  const pattern = a.segments
    .map((n) => `<span class="meter-seg num">${n}</span>`)
    .join('<span class="meter-sep" aria-hidden="true">・</span>');
  const status = a.fits
    ? `<span class="meter-status is-fit">${icons.check}<span>定型</span></span>`
    : `<span class="meter-status">${a.diff > 0 ? `字余り +${a.diff}` : `字足らず ${a.diff}`}</span>`;
  const summary = a.fits
    ? `${a.total}拍、定型に合う`
    : a.diff > 0
      ? `${a.total}拍、定型より${a.diff}拍多い`
      : `${a.total}拍、定型より${-a.diff}拍少ない`;
  return (
    `<span class="meter-pattern">${pattern}</span>` +
    `<span class="meter-total"><span class="num">${a.total}</span>拍</span>` +
    status +
    `<span class="sr-only">(${summary})</span>`
  );
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
  /** 季節の指定がないときに開く季節(起動日の時季) */
  initialSeason: Season;
}

export function createApp({ root, store, initialPoems, today, initialSeason }: AppDeps): void {
  let poems = sortByDateDesc(initialPoems);
  let view: View = parseView(location.hash);
  let filter: SaijikiFilter = parseFilter(location.hash, initialSeason);
  /** 「この季語で詠む」で詠草帳へ持ち越す季語 */
  let composeKigo = '';
  let themeChoice = readTheme();
  /** 詠草帳の絞り込みと並び順、編集中の詠草 */
  let poemFilter: PoemFilter = { ...DEFAULT_POEM_FILTER };
  let poemSort: SortDir = 'desc';
  let editingId: string | null = null;

  const seasonOf = (kigo: string): Season | undefined => findKigo(KIGO, kigo)?.season;

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
          <button type="button" class="season-tab" role="tab" id="tab-${s}"
            aria-controls="results" aria-selected="${s === filter.season && filter.query.trim() === ''}"
            tabindex="${s === filter.season ? '0' : '-1'}"
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
        <div class="season-tabs" role="tablist" aria-label="季節を選ぶ">${seasonTabs}</div>
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
    for (const el of root.querySelectorAll<HTMLElement>('.season-tab')) {
      const isCurrent = el.dataset.season === filter.season;
      el.setAttribute('aria-selected', String(isCurrent && filter.query.trim() === ''));
      // ロービングタブ: 現在の季節だけをタブ移動の入口にする
      el.tabIndex = isCurrent ? 0 : -1;
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

  function selectSeason(season: Season): void {
    filter = { ...filter, season, query: '' };
    const search = root.querySelector<HTMLInputElement>('#search');
    if (search) search.value = '';
    syncSeasonTabs();
    updateHero();
    updateResults('enter');
    pushFilterToHash();
  }

  function mountSaijiki(main: HTMLElement): void {
    main.innerHTML = `
      <section class="view view-saijiki">
        ${heroMarkup()}
        ${toolbarMarkup()}
        <div class="results" id="results" role="tabpanel" tabindex="0"
          aria-label="季語の一覧"></div>
      </section>`;

    const tabs = Array.from(main.querySelectorAll<HTMLButtonElement>('.season-tab'));
    for (const el of tabs) {
      el.addEventListener('click', () => selectSeason(el.dataset.season as Season));
    }
    // 矢印・Home/Endでタブ間を移動して即座に切り替える(WAI-ARIAのタブ)
    main.querySelector<HTMLElement>('.season-tabs')?.addEventListener('keydown', (e) => {
      const ke = e as KeyboardEvent;
      const from = tabs.findIndex((t) => t === document.activeElement);
      const to = nextIndex(from < 0 ? 0 : from, ke.key, tabs.length);
      if (to === null) return;
      ke.preventDefault();
      const target = tabs[to];
      if (target) {
        selectSeason(target.dataset.season as Season);
        target.focus();
      }
    });
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
    const editing = p.id === editingId;
    const meter = meterMarkup(p.reading ?? '', p.kind);
    return `
      <li class="poem reveal${editing ? ' is-editing' : ''}" style="--i:${index}" data-poem="${esc(p.id)}">
        <p class="poem-text">${esc(p.text)}</p>
        <div class="poem-meta">
          <span class="poem-kind">${KIND_LABELS[p.kind]}</span>
          ${kigoTag}
          ${meter !== '' ? `<span class="meter poem-meter">${meter}</span>` : ''}
          <span class="poem-date">${formatDateJa(p.date)}</span>
          <span class="poem-tools">
            <button type="button" class="icon-button" data-copy="${esc(p.id)}"
              aria-label="この句歌を書き写す(コピー)">${icons.copy}</button>
            <button type="button" class="icon-button" data-edit="${esc(p.id)}"
              aria-label="この詠草を直す">${icons.edit}</button>
            <button type="button" class="icon-button danger" data-del="${esc(p.id)}"
              aria-label="この詠草を削除">${icons.trash}</button>
          </span>
        </div>
        ${p.memo !== '' ? `<p class="poem-memo">${esc(p.memo)}</p>` : ''}
      </li>`;
  }

  function displayedPoems(): Poem[] {
    return sortByDate(filterPoems(poems, poemFilter, seasonOf), poemSort);
  }

  function isPoemFilterActive(): boolean {
    return (
      poemFilter.kind !== 'all' || poemFilter.season !== 'all' || poemFilter.text.trim() !== ''
    );
  }

  function poemCountMarkup(): string {
    if (poems.length === 0) return '<span class="num">0</span> 句歌';
    const shown = displayedPoems().length;
    return isPoemFilterActive()
      ? `全 <span class="num">${poems.length}</span> 件中 <span class="num">${shown}</span> 句歌`
      : `<span class="num">${poems.length}</span> 句歌`;
  }

  function poemListMarkup(): string {
    if (poems.length === 0) {
      return '<p class="empty">詠草はまだありません。歳時記で季語をひき、最初の一句を書き留めてください。</p>';
    }
    const shown = displayedPoems();
    if (shown.length === 0) {
      return '<p class="empty">条件に当てはまる詠草がありません。絞り込みをゆるめてみてください。</p>';
    }
    return `<ul class="poems">${shown.map((p, i) => poemItem(p, i)).join('')}</ul>`;
  }

  function updatePoems(mode: 'enter' | 'swap'): void {
    const box = root.querySelector<HTMLElement>('#poem-results');
    if (!box) return;
    box.innerHTML = poemListMarkup();
    reveal(box, mode);
    bindPoemActions(box);
    const count = root.querySelector<HTMLElement>('[data-poem-count]');
    if (count) count.innerHTML = poemCountMarkup();
    syncEisouActions();
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
    const filterKindOptions = '<option value="all">すべての形式</option>' + kindOptions;
    const filterSeasonOptions =
      '<option value="all">すべての季</option>' +
      (Object.keys(SEASON_LABELS) as Season[])
        .map((s) => `<option value="${s}">${SEASON_LABELS[s]}</option>`)
        .join('') +
      '<option value="muki">無季</option>';
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
          <div class="compose-reading">
            <input name="reading" id="compose-reading" class="grow"
              placeholder="よみ(任意・分かち書きで五七五を確かめる)" aria-label="よみ(かな)"
              autocomplete="off" />
            <p class="meter" data-meter hidden></p>
          </div>
          <div class="compose-row">
            <select name="kind" aria-label="形式">${kindOptions}</select>
            <input name="kigo" id="compose-kigo" list="kigo-words" value="${esc(composeKigo)}"
              placeholder="季語(無季なら空)" aria-label="季語" autocomplete="off" />
            <datalist id="kigo-words">
              ${KIGO.map((k) => `<option value="${esc(k.word)}"></option>`).join('')}
            </datalist>
            <input name="date" type="date" value="${today}" required aria-label="詠んだ日" />
            <input name="memo" placeholder="覚え書き(任意)" aria-label="覚え書き" class="grow" />
            <button type="button" class="link-button compose-cancel" data-compose-cancel hidden>
              ${icons.close}<span>やめる</span></button>
            <button type="submit" class="button primary">${icons.plus}<span data-submit-label>書き留める</span></button>
          </div>
        </form>
        <div class="eisou-controls">
          <div class="eisou-filters">
            <select data-poem-kind aria-label="形式で絞り込む">${filterKindOptions}</select>
            <select data-poem-season aria-label="季節で絞り込む">${filterSeasonOptions}</select>
            <label class="search">${icons.search}
              <input type="search" data-poem-search placeholder="詠草を探す"
                aria-label="詠草を本文・季語・覚え書きで探す" autocomplete="off" /></label>
            <button type="button" class="sort-toggle" data-poem-sort></button>
          </div>
          <div class="eisou-actions">
            <button type="button" class="link-button" data-export>${icons.download}<span>書き出す</span></button>
            <label class="link-button" for="import-file">${icons.upload}<span>取り込む</span></label>
            <input type="file" id="import-file" accept="application/json,.json" hidden />
          </div>
        </div>
        <p class="results-count" data-poem-count></p>
        <div class="poem-results" id="poem-results"></div>
      </section>`;

    composeKigo = '';
    editingId = null;
    const form = main.querySelector<HTMLFormElement>('#compose-form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget as HTMLFormElement);
      const read = (key: string): string => String(fd.get(key) ?? '').trim();
      const text = read('text');
      const date = read('date');
      if (text === '' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const fields = {
        kind: (read('kind') || 'haiku') as PoemKind,
        text,
        reading: read('reading'),
        kigo: read('kigo'),
        date,
        memo: read('memo'),
      };
      if (editingId !== null) {
        poems = updatePoem(poems, editingId, fields);
        endEdit();
        form.reset();
        resetComposeDate(main);
        updateComposeMeter();
        commit('swap');
        announce('詠草を直しました。');
      } else {
        poems.push({ id: newPoemId(), ...fields });
        form.reset();
        resetComposeDate(main);
        updateComposeMeter();
        commit('swap');
        main.querySelector<HTMLTextAreaElement>('#compose-text')?.focus();
      }
    });

    main
      .querySelector<HTMLButtonElement>('[data-compose-cancel]')
      ?.addEventListener('click', () => {
        endEdit();
        form?.reset();
        resetComposeDate(main);
        updateComposeMeter();
        updatePoems('swap');
      });

    bindEisouControls(main);
    bindComposeMeter(main);
    updatePoems('enter');
  }

  function resetComposeDate(scope: ParentNode): void {
    const dateInput = scope.querySelector<HTMLInputElement>('input[name="date"]');
    if (dateInput) dateInput.value = today;
  }

  /** よみと形式から、作成フォームの拍メーターを描き直す */
  function updateComposeMeter(): void {
    const meter = root.querySelector<HTMLElement>('#compose-form [data-meter]');
    const reading = root.querySelector<HTMLInputElement>('#compose-reading');
    const kindSel = root.querySelector<HTMLSelectElement>('#compose-form [name="kind"]');
    if (!meter || !reading) return;
    const markup = meterMarkup(reading.value, (kindSel?.value as PoemKind) || 'haiku');
    meter.innerHTML = markup;
    meter.hidden = markup === '';
  }

  function bindComposeMeter(scope: HTMLElement): void {
    scope.querySelector<HTMLInputElement>('#compose-reading')?.addEventListener('input', updateComposeMeter);
    scope.querySelector<HTMLSelectElement>('#compose-form [name="kind"]')?.addEventListener('change', updateComposeMeter);
    updateComposeMeter();
  }

  function bindEisouControls(scope: HTMLElement): void {
    const kind = scope.querySelector<HTMLSelectElement>('[data-poem-kind]');
    kind?.addEventListener('change', () => {
      poemFilter = { ...poemFilter, kind: kind.value as PoemFilter['kind'] };
      updatePoems('swap');
    });
    const season = scope.querySelector<HTMLSelectElement>('[data-poem-season]');
    season?.addEventListener('change', () => {
      poemFilter = { ...poemFilter, season: season.value as PoemFilter['season'] };
      updatePoems('swap');
    });
    const search = scope.querySelector<HTMLInputElement>('[data-poem-search]');
    search?.addEventListener('input', () => {
      poemFilter = { ...poemFilter, text: search.value };
      updatePoems('swap');
    });
    scope.querySelector<HTMLButtonElement>('[data-poem-sort]')?.addEventListener('click', () => {
      poemSort = poemSort === 'desc' ? 'asc' : 'desc';
      syncSortToggle();
      updatePoems('swap');
    });
    scope.querySelector<HTMLButtonElement>('[data-export]')?.addEventListener('click', exportPoems);
    scope.querySelector<HTMLInputElement>('#import-file')?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void importPoems(file);
      (e.target as HTMLInputElement).value = '';
    });
    syncSortToggle();
    syncComposeMode();
  }

  function syncSortToggle(): void {
    const btn = root.querySelector<HTMLButtonElement>('[data-poem-sort]');
    if (!btn) return;
    const desc = poemSort === 'desc';
    btn.innerHTML = `${desc ? icons.sortDesc : icons.sortAsc}<span>${desc ? '新しい順' : '古い順'}</span>`;
    btn.setAttribute('aria-label', `並び順: ${desc ? '新しい順' : '古い順'}(押すと入れ替え)`);
  }

  function syncEisouActions(): void {
    const exportBtn = root.querySelector<HTMLButtonElement>('[data-export]');
    if (exportBtn) exportBtn.toggleAttribute('disabled', poems.length === 0);
  }

  function syncComposeMode(): void {
    const label = root.querySelector<HTMLElement>('[data-submit-label]');
    const cancel = root.querySelector<HTMLButtonElement>('[data-compose-cancel]');
    const form = root.querySelector<HTMLFormElement>('#compose-form');
    if (label) label.textContent = editingId !== null ? '直す' : '書き留める';
    if (cancel) cancel.hidden = editingId === null;
    form?.classList.toggle('is-editing', editingId !== null);
  }

  function endEdit(): void {
    editingId = null;
    syncComposeMode();
  }

  function startEdit(id: string): void {
    const p = poems.find((x) => x.id === id);
    const form = root.querySelector<HTMLFormElement>('#compose-form');
    if (!p || !form) return;
    editingId = id;
    (form.querySelector('[name="text"]') as HTMLTextAreaElement).value = p.text;
    (form.querySelector('[name="kind"]') as HTMLSelectElement).value = p.kind;
    (form.querySelector('[name="reading"]') as HTMLInputElement).value = p.reading ?? '';
    (form.querySelector('[name="kigo"]') as HTMLInputElement).value = p.kigo;
    (form.querySelector('[name="date"]') as HTMLInputElement).value = p.date;
    (form.querySelector('[name="memo"]') as HTMLInputElement).value = p.memo;
    updateComposeMeter();
    syncComposeMode();
    updatePoems('swap');
    form.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    form.querySelector<HTMLTextAreaElement>('#compose-text')?.focus();
  }

  async function copyPoem(id: string): Promise<void> {
    const p = poems.find((x) => x.id === id);
    if (!p) return;
    if (!navigator.clipboard) {
      announce('この環境では書き写せません。本文を選択してコピーしてください。');
      return;
    }
    try {
      await navigator.clipboard.writeText(p.text);
      announce('句歌を書き写しました(クリップボードへ)。');
    } catch {
      announce('書き写せませんでした。本文を選択してコピーしてください。');
    }
  }

  function bindPoemActions(scope: HTMLElement): void {
    for (const el of scope.querySelectorAll<HTMLElement>('[data-del]')) {
      el.addEventListener('click', () => {
        const id = el.dataset.del ?? '';
        if (editingId === id) endEdit();
        poems = poems.filter((p) => p.id !== id);
        commit('swap');
        announce('詠草を削除しました。');
      });
    }
    for (const el of scope.querySelectorAll<HTMLElement>('[data-edit]')) {
      el.addEventListener('click', () => startEdit(el.dataset.edit ?? ''));
    }
    for (const el of scope.querySelectorAll<HTMLElement>('[data-copy]')) {
      el.addEventListener('click', () => void copyPoem(el.dataset.copy ?? ''));
    }
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

  function render(focusMain = false): void {
    dispose();
    root.innerHTML = `
      <a class="skip-link" href="#main">本文へスキップ</a>
      ${header()}
      <main class="site-main" id="main" tabindex="-1"></main>
      <footer class="site-footer">
        <p>歳時記と詠草帳。詠草はこの端末のブラウザにだけ保存されます。</p>
      </footer>`;
    bindHeader();
    root.querySelector<HTMLAnchorElement>('.skip-link')?.addEventListener('click', (e) => {
      // ハッシュルーティングを乱さずに本文へフォーカスを移す
      e.preventDefault();
      const m = root.querySelector<HTMLElement>('#main');
      m?.focus();
      m?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    });
    const main = root.querySelector<HTMLElement>('#main');
    if (!main) return;
    if (view === 'saijiki') mountSaijiki(main);
    else mountEisou(main);
    if (focusMain) main.focus();
  }

  window.addEventListener('hashchange', () => {
    const nextView = parseView(location.hash);
    if (nextView === 'saijiki') filter = parseFilter(location.hash, initialSeason);
    if (nextView !== view) {
      view = nextView;
      render(true);
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

  // 「/」で検索へ。文字入力中は邪魔しない。
  window.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const active = document.activeElement as HTMLElement | null;
    const tag = active?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || active?.isContentEditable) return;
    const target = root.querySelector<HTMLInputElement>(
      view === 'saijiki' ? '#search' : '[data-poem-search]',
    );
    if (target) {
      e.preventDefault();
      target.focus();
    }
  });

  applyTheme();
  render();
}
