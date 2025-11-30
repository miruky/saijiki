import './style.css';
import { createApp } from './app';
import { createStore } from './lib/poems';
import { seasonForDate } from './lib/season';
import { seedPoems } from './lib/seed';

const root = document.getElementById('app');
if (!root) throw new Error('#app が見つかりません');

const store = createStore(localStorage);

// 初回起動だけ見本の詠草を入れて保存する。一度でも保存があれば
// (全件削除して空にした場合も含めて)その状態を尊重する。
let poems = store.load();
if (poems === null) {
  poems = seedPoems();
  store.save(poems);
}

const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

createApp({ root, store, initialPoems: poems, today, initialSeason: seasonForDate(d) });
