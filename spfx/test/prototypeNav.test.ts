import * as fs from 'fs';
import * as path from 'path';

// Прототип в jsdom: переходы по вкладкам (#23, #24) — так же, как logic/route.ts приложения (route.test.ts)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JSDOM } = require('jsdom');
const HTML = fs.readFileSync(path.join(__dirname, '../../prototype/pmo-prototype.html'), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = any;
let w: W;
beforeEach(async () => {
  w = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://pmo.test/', beforeParse(win: W) {
    win.matchMedia = () => ({ matches: false, addEventListener() { /* */ }, removeEventListener() { /* */ }, addListener() { /* */ } });
    win.HTMLElement.prototype.scrollIntoView = function (): void { /* */ }; win.scrollTo = () => undefined; } }).window;
  for (let i = 0; i < 20 && !w.document.querySelector('[data-act="nav"]'); i++) await new Promise(r => setTimeout(r, 0));
});
afterEach(() => { if (w) w.close(); });
const q = (s: string): W => w.document.querySelector(s);
const viewOf = (): string => (q('select[data-act="view"]') || {}).value;

test('#23: показатель главной открывает свой вид, вкладка в шапке — вид по умолчанию', () => {
  const kpi = q('[data-act="goview"][data-page="projects"][data-view="late"]') || q('[data-act="goview"][data-page="projects"]:not([data-view="all"])');
  expect(kpi).not.toBeNull();
  const view = kpi.dataset.view; kpi.click();
  expect(viewOf()).toBe(view);
  q('[data-act="nav"][data-page="home"]').click();
  q('[data-act="nav"][data-page="projects"]').click();
  expect(viewOf()).toBe('all');
});
test('#24: вид «Ризики» по умолчанию — «Відкриті» после перехода с другим видом', () => {
  const sel = (() => { q('[data-act="nav"][data-page="risks"]').click(); return q('select[data-act="view"]'); })();
  sel.value = 'high'; sel.dispatchEvent(new w.Event('change', { bubbles: true }));
  expect(viewOf()).toBe('high');
  q('[data-act="nav"][data-page="projects"]').click();
  q('[data-act="nav"][data-page="risks"]').click();
  expect(viewOf()).toBe('open');
});

// #3 и порядок списков — как logic/status.ts приложения (staleFirst, newestFirst)
test('#3: «Немає свіжого статус-звіту» на главной — сначала без отчётов, дальше от самого давнего', () => {
  const wp = Array.from(w.document.querySelectorAll('.wp')).find((x: W) => /Немає свіжого|No fresh|Нет свежего/.test(x.textContent)) as W;
  expect(wp).toBeDefined();
  // колонка «Останній статус-звіт» — предпоследняя (последняя — статус)
  const rows = Array.from(wp.querySelectorAll('tbody tr')).map((tr: W) => { const td = tr.querySelectorAll('td'); return td[td.length - 2].textContent.trim(); });
  expect(rows.some(r => /\d{2}\.\d{2}\.\d{4}/.test(r))).toBe(true);   // в демо-данных есть и проекты с давним отчётом
  expect(rows.length).toBeGreaterThan(1);
  const iso = (t: string): string => { const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(t); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
  const keys = rows.map(iso);
  const firstDated = keys.findIndex(k => !!k);
  if (firstDated > 0) expect(keys.slice(0, firstDated).every(k => !k)).toBe(true);           // без отчётов — первыми
  const dated = keys.filter(k => !!k);
  expect(dated).toEqual(dated.slice().sort());                                                // дальше — от самого давнего
});
test('список «Проєкти» — новые сверху (как в приложении)', () => {
  q('[data-act="nav"][data-page="projects"]').click();
  const ids = Array.from(w.document.querySelectorAll('[data-act="openp"]')).map((x: W) => Number(x.dataset.id));
  const uniq = ids.filter((x, i) => ids.indexOf(x) === i);
  expect(uniq.length).toBeGreaterThan(2);
  expect(uniq).toEqual(uniq.slice().sort((a, b) => b - a));
});
