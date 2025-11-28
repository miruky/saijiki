// 画面の描画と遷移。歳時記(#/)と詠草帳(#/eisou)の2画面をハッシュで切り替え、
// 状態が変わるたびに現在の画面を丸ごと描き直す。
// テキスト入力はchangeイベント(確定時)で反映するので、再描画で入力が途切れない。

import { KIGO } from './data/kigo';
import {
  CATEGORY_LABELS,
  findKigo,
  searchKigo,
  SEASON_LABELS,
  type Kigo,
  type KigoCategory,
  type Season,
} from './lib/kigo';
import {
  KIND_LABELS,
  newPoemId,
  sortByDateDesc,
  type Poem,
  type PoemKind,
  type PoemStore,
} from './lib/poems';
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

export interface AppDeps {
  root: HTMLElement;
  store: PoemStore;
  initialPoems: Poem[];
  today: string;
}

export function createApp({ root, store, initialPoems, today }: AppDeps): void {
  let poems = sortByDateDesc(initialPoems);
  let view: 'saijiki' | 'eisou' = location.hash === '#/eisou' ? 'eisou' : 'saijiki';
  let season: Season = 'spring';
  let category: KigoCategory | '' = '';
  let query = '';
  /** 「この季語で詠む」で持ち越す季語 */
  let composeKigo = '';

  function commit(): void {
    poems = sortByDateDesc(poems);
    store.save(poems);
    render();
  }

  window.addEventListener('hashchange', () => {
    view = location.hash === '#/eisou' ? 'eisou' : 'saijiki';
    render();
  });

  function header(): string {
    return `
      <header class="site-header">
        <div class="site-header-inner">
          <a class="brand" href="#/">${icons.logo}<span>saijiki</span></a>
          <nav aria-label="主要">
            <a href="#/" ${view === 'saijiki' ? 'aria-current="page"' : ''}>${icons.book}<span>歳時記</span></a>
            <a href="#/eisou" ${view === 'eisou' ? 'aria-current="page"' : ''}>${icons.pen}<span>詠草帳<small>${poems.length}</small></span></a>
          </nav>
        </div>
      </header>`;
  }

  // ---- 歳時記 ----

  function kigoCard(k: Kigo, index: number): string {
    const used = poems.filter((p) => p.kigo === k.word).length;
    return `
      <li class="kigo-card" style="--i:${index}">
        <div class="kigo-head">
          <h2>${esc(k.word)}</h2>
          <span class="kigo-reading">${esc(k.reading)}</span>
          <span class="kigo-tags">
            <span class="tag season-${k.season}">${SEASON_LABELS[k.season]}</span>
            <span class="tag">${CATEGORY_LABELS[k.category]}</span>
          </span>
        </div>
        ${k.variants.length > 0 ? `<p class="kigo-variants">傍題: ${esc(k.variants.join('、'))}</p>` : ''}
        <p class="kigo-note">${esc(k.note)}</p>
        <div class="kigo-actions">
          ${used > 0 ? `<span class="used-count">詠草 ${used}句</span>` : ''}
          <button type="button" class="button small" data-compose="${esc(k.word)}">
            ${icons.pen}<span>この季語で詠む</span></button>
        </div>
      </li>`;
  }

  function saijikiView(): string {
    const q = query.trim();
    // 文字検索のときは季節をまたいで探し、それ以外は選んだ季節の中を見る
    const hits =
      q !== ''
        ? searchKigo(KIGO, { text: q, category: category === '' ? undefined : category })
        : searchKigo(KIGO, { season, category: category === '' ? undefined : category });
    const seasonTabs = (Object.keys(SEASON_LABELS) as Season[])
      .map(
        (s) => `
          <button type="button" class="season-tab ${s === season && q === '' ? 'active' : ''}"
            data-season="${s}">${SEASON_LABELS[s]}</button>`,
      )
      .join('');
    const categoryOptions = (Object.keys(CATEGORY_LABELS) as KigoCategory[])
      .map(
        (c) =>
          `<option value="${c}" ${c === category ? 'selected' : ''}>${CATEGORY_LABELS[c]}</option>`,
      )
      .join('');
    return `
      <section class="view">
        <div class="toolbar">
          <div class="season-tabs" role="group" aria-label="季節">${seasonTabs}</div>
          <select id="filter-category" aria-label="分類で絞り込む">
            <option value="">すべての分類</option>
            ${categoryOptions}
          </select>
          <label class="search">${icons.search}
            <input type="search" id="search" placeholder="季語・読みで探す"
              value="${esc(query)}" aria-label="季語を検索" /></label>
        </div>
        ${
          hits.length === 0
            ? '<p class="empty">条件に当てはまる季語がありません。</p>'
            : `<ul class="kigo-list">${hits.map((k, i) => kigoCard(k, i)).join('')}</ul>`
        }
      </section>`;
  }

  function bindSaijikiView(): void {
    for (const el of root.querySelectorAll<HTMLElement>('[data-season]')) {
      el.addEventListener('click', () => {
        season = el.dataset.season as Season;
        query = '';
        render();
      });
    }
    root.querySelector('#filter-category')?.addEventListener('change', (e) => {
      category = (e.target as HTMLSelectElement).value as KigoCategory | '';
      render();
    });
    const search = root.querySelector<HTMLInputElement>('#search');
    search?.addEventListener('input', () => {
      query = search.value;
      render();
    });
    for (const el of root.querySelectorAll<HTMLElement>('[data-compose]')) {
      el.addEventListener('click', () => {
        composeKigo = el.dataset.compose ?? '';
        location.hash = '#/eisou';
      });
    }
  }

  // ---- 詠草帳 ----

  function poemItem(p: Poem, index: number): string {
    const kigoEntry = p.kigo !== '' ? findKigo(KIGO, p.kigo) : undefined;
    return `
      <li class="poem" style="--i:${index}">
        <p class="poem-text">${esc(p.text)}</p>
        <div class="poem-meta">
          <span class="tag">${KIND_LABELS[p.kind]}</span>
          ${
            p.kigo !== ''
              ? `<span class="tag ${kigoEntry ? `season-${kigoEntry.season}` : ''}">${esc(p.kigo)}${kigoEntry ? `・${SEASON_LABELS[kigoEntry.season]}` : ''}</span>`
              : '<span class="tag">無季</span>'
          }
          <span class="poem-date">${formatDateJa(p.date)}</span>
          <button type="button" class="icon-button" id="poem-${index}-del" data-del="${index}"
            aria-label="この詠草を削除">${icons.trash}</button>
        </div>
        ${p.memo !== '' ? `<p class="poem-memo">${esc(p.memo)}</p>` : ''}
      </li>`;
  }

  function eisouView(): string {
    const kindOptions = (Object.keys(KIND_LABELS) as PoemKind[])
      .map((k) => `<option value="${k}">${KIND_LABELS[k]}</option>`)
      .join('');
    return `
      <section class="view">
        <section class="panel compose">
          <h2>詠む</h2>
          <form id="compose-form">
            <textarea name="text" id="compose-text" rows="2" required
              placeholder="蝉時雨 やみて夕立 来たりけり" aria-label="本文"></textarea>
            <div class="compose-row">
              <select name="kind" aria-label="形式">${kindOptions}</select>
              <input name="kigo" id="compose-kigo" list="kigo-words" value="${esc(composeKigo)}"
                placeholder="季語(無季なら空)" aria-label="季語" />
              <datalist id="kigo-words">
                ${KIGO.map((k) => `<option value="${esc(k.word)}"></option>`).join('')}
              </datalist>
              <input name="date" type="date" value="${today}" required aria-label="詠んだ日" />
              <input name="memo" placeholder="覚え書き(任意)" aria-label="覚え書き" class="grow" />
              <button type="submit" class="button primary">${icons.plus}<span>書き留める</span></button>
            </div>
          </form>
        </section>
        ${
          poems.length === 0
            ? '<p class="empty">詠草はまだありません。最初の一句を書き留めてください。</p>'
            : `<ul class="poems">${poems.map((p, i) => poemItem(p, i)).join('')}</ul>`
        }
      </section>`;
  }

  function bindEisouView(): void {
    root.querySelector<HTMLFormElement>('#compose-form')?.addEventListener('submit', (e) => {
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
      composeKigo = '';
      commit();
      root.querySelector<HTMLTextAreaElement>('#compose-text')?.focus();
    });
    for (const el of root.querySelectorAll<HTMLElement>('[data-del]')) {
      el.addEventListener('click', () => {
        poems.splice(Number(el.dataset.del), 1);
        commit();
      });
    }
  }

  function render(): void {
    const activeId = document.activeElement instanceof HTMLElement ? document.activeElement.id : '';
    const body = view === 'saijiki' ? saijikiView() : eisouView();
    root.innerHTML = `
      ${header()}
      <main class="site-main">${body}</main>
      <footer class="site-footer">
        <p>saijiki — 歳時記と詠草帳。詠草はこの端末のブラウザにだけ保存されます。</p>
      </footer>`;
    if (view === 'saijiki') bindSaijikiView();
    else bindEisouView();
    if (activeId !== '') document.getElementById(activeId)?.focus();
  }

  render();
}
