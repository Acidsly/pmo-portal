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
  expect(firstDated).toBeGreaterThan(0);                                                      // в демо-данных есть проект без отчётов
  expect(keys.slice(0, firstDated).every(k => !k)).toBe(true);                               // без отчётов — первыми
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

test('#36 прототип: виды «Мої проєкти (усі)» и «Я PM» есть; «Я PM» — подмножество «Мої проєкти (усі)»', () => {
  q('[data-act="nav"][data-page="projects"]').click();
  const sel = q('select[data-act="view"]');
  const opts = Array.from(sel.options).map((o: W) => o.value);
  expect(opts).toEqual(expect.arrayContaining(['mine', 'pm']));
  const ids = (v: string): number[] => { const s = q('select[data-act="view"]'); s.value = v; s.dispatchEvent(new w.Event('change', { bubbles: true }));
    return Array.from(new Set(Array.from(w.document.querySelectorAll('[data-act="openp"]')).map((x: W) => Number(x.dataset.id)))); };
  const mine = ids('mine'), pm = ids('pm');
  expect(pm.length).toBeGreaterThan(0);
  expect(pm.length).toBeLessThan(mine.length);                 // в демо-данных я и PM, и участник других проектов
  pm.forEach(id => expect(mine).toContain(id));
});

test('#58 прототип: карточки отчётов и рисков — те же строки, что в таблице', () => {
  for (const page of ['reports', 'risks']) {
    q(`[data-act="nav"][data-page="${page}"]`).click();
    const rows = w.document.querySelectorAll('.tablewrap.dt.has-cards tbody tr').length;
    expect(rows).toBeGreaterThan(0);
    expect(w.document.querySelectorAll('.mcards .mcard').length).toBe(rows);
  }
  // карточка открывает отчёт
  q('[data-act="nav"][data-page="reports"]').click();
  q('.mcards .mcard').click();
  expect(w.document.querySelector('.pmo-panel.open, .pmo-panel[aria-hidden="false"], .panel.open') || w.document.querySelector('[data-act="decide"], .rv-meta')).not.toBeNull();
});

test('#35, #49 прототип: ширина колонки перетаскиванием запоминается, сброс — из меню колонок', () => {
  q('[data-act="nav"][data-page="risks"]').click();
  // перерисовка без перехода (смена вида) — ширины уже закреплены по первой раскладке, у заголовков появляется ручка
  const vs = q('select[data-act="view"]'); vs.value = 'all'; vs.dispatchEvent(new w.Event('change', { bubbles: true }));
  const h = q('.dt .col-rs');
  expect(h).not.toBeNull();
  const key = h.dataset.rs, id = h.dataset.col;
  const pe = (t: string, x: number): W => { const e = new w.MouseEvent(t, { bubbles: true, cancelable: true, clientX: x }); return e; };
  h.dispatchEvent(pe('pointerdown', 100)); w.dispatchEvent(pe('pointermove', 160)); w.dispatchEvent(pe('pointerup', 160));
  const saved = JSON.parse(w.localStorage.getItem('pmo-table5-' + key));
  expect(saved.w[id]).toBeGreaterThanOrEqual(56);
  // после отрисовки ширина колонки — заданная
  const idx = Array.from(q('.dt thead tr').children).findIndex((th: W) => th.querySelector(`.col-rs[data-col="${id}"]`));
  expect(parseFloat(q('.dt table').querySelectorAll('col')[idx].style.width)).toBe(saved.w[id]);
  // сброс
  const b = w.document.createElement('button'); b.dataset.act = 'wreset'; b.dataset.key = key; w.document.body.appendChild(b); b.click();
  expect(JSON.parse(w.localStorage.getItem('pmo-table5-' + key)).w).toBeUndefined();
});
test('кросс-ревью, прототип: отмена жеста — ширина не сохраняется; правая кнопка — не тянет', () => {
  q('[data-act="nav"][data-page="risks"]').click();
  const vs = q('select[data-act="view"]'); vs.value = 'all'; vs.dispatchEvent(new w.Event('change', { bubbles: true }));
  const h = q('.dt .col-rs'); const key = h.dataset.rs;
  const pe = (t: string, x: number, button = 0): W => new w.MouseEvent(t, { bubbles: true, cancelable: true, clientX: x, button });
  h.dispatchEvent(pe('pointerdown', 100)); w.dispatchEvent(pe('pointermove', 180)); w.dispatchEvent(pe('pointercancel', 180));
  w.dispatchEvent(pe('pointerup', 300));
  expect(((JSON.parse(w.localStorage.getItem('pmo-table5-' + key) || '{}')).w || {})).toEqual({});
  const h2 = q('.dt .col-rs');
  h2.dispatchEvent(pe('pointerdown', 100, 2)); w.dispatchEvent(pe('pointerup', 200));
  expect(((JSON.parse(w.localStorage.getItem('pmo-table5-' + key) || '{}')).w || {})).toEqual({});
});
