import * as fs from 'fs';
import * as path from 'path';
import { T } from '../src/webparts/pmoPortal/i18n/strings';

// Сверка покрытия отзывов 29–53 (раунд 2) на прототипе в jsdom: поведение, которого не проверял ни один тест (настройка — как в prototypeForms2.test.ts)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JSDOM } = require('jsdom');
const HTML = fs.readFileSync(path.join(__dirname, '../../prototype/pmo-prototype.html'), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = any;
let w: W;
beforeEach(async () => {
  w = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://pmo.test/', beforeParse(win: W) {
    win.confirm = () => true;   // #134: «закрыть без сохранения» — да (jsdom confirm не реализует)
    win.matchMedia = () => ({ matches: false, addEventListener() { /* */ }, removeEventListener() { /* */ }, addListener() { /* */ } });
    win.HTMLElement.prototype.scrollIntoView = function (): void { /* */ }; win.scrollTo = () => undefined; } }).window;
  for (let i = 0; i < 20 && !w.document.querySelector('[data-act="lang"]'); i++) await new Promise(r => setTimeout(r, 0));
  w.document.querySelector('[data-act="lang"][data-i="0"]').click();
});
afterEach(() => { if (w) w.close(); });
const q = (s: string): W => w.document.querySelector(s);
const qa = (s: string): W[] => Array.from(w.document.querySelectorAll(s));
const ev = (el: W, t: string): void => { el.dispatchEvent(new w.Event(t, { bubbles: true })); };
const nav = (page: string): void => q(`[data-act="nav"][data-page="${page}"]`).click();
const listMode = (key: string): void => { const b = q(`[data-act="mode"][data-key="${key}"][data-mode="list"]`); if (b) b.click(); };
function asUser(n: string): void { const b = w.document.createElement('button'); b.dataset.act = 'asuser'; b.dataset.n = n; w.document.body.appendChild(b); b.click(); b.remove(); }
const setView = (v: string): void => { const s = q('select[data-act="view"]'); s.value = v; ev(s, 'change'); };
const openForm = (): W => { nav('reports'); q('[data-act="newrep"]:not([data-id])').click(); return q('#repform'); };

// #29: проект, у которого погоджених отчётов нет, а первый — на погодженні: в колонке «Звіт» — «немає звітів» и «На погодженні · дата»
test('#29 первый отчёт проекта на погодженні — виден в колонке «Звіт» и на плитке', () => {
  asUser('Олександра Мороз');                       // PMO заводит проект
  nav('projects'); q('[data-act="newproj"]').click();
  const f = q('#pform'); const g = (id: string): W => f.querySelector('#' + id);
  g('p-title').value = 'Проєкт без погоджених'; ev(g('p-title'), 'input');
  const pm = g('p-pm'); const pmName = (Array.from(pm.options).map((o: W) => o.value).filter(Boolean) as string[]).filter(n => n !== 'Олександра Мороз')[0];
  pm.value = pmName; ev(pm, 'change');
  g('p-country').value = 'Польща'; ev(g('p-country'), 'change');
  f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  expect(q('#pform')).toBeNull();
  asUser(pmName); nav('projects'); listMode('projMode');
  const row = (): W => qa('#main table tbody tr').filter((tr: W) => tr.textContent.indexOf('Проєкт без погоджених') >= 0)[0];
  expect(row()).toBeDefined();
  const id = row().querySelector('[data-act="openp"]').dataset.id;
  expect(row().querySelector('.rep-ap')).toBeNull();     // отчётов ещё нет
  q(`[data-act="openp"][data-id="${id}"]`).click(); q(`[data-act="newrep"][data-id="${id}"]`).click();
  const r = q('#repform');
  ['sched', 'budget', 'res'].forEach(n => { const x = r.querySelector(`input[name="${n}"][value="Зелений"]`); x.checked = true; ev(x, 'change'); });
  const t = r.querySelector('#f-t'); t.value = 'Перший звіт'; ev(t, 'input');
  r.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  expect(q('#repform')).toBeNull();
  nav('projects'); listMode('projMode');
  const txt = row().textContent;
  expect(txt).toContain(T.noReports[0]);
  const mark = row().querySelector('.rep-ap'); expect(mark).not.toBeNull();
  expect(mark.textContent).toContain('На погодженні'); expect(mark.querySelector('.muted')).not.toBeNull();   // с датой
  // плитка — то же
  q('[data-act="mode"][data-key="projMode"][data-mode="tiles"]').click();
  const tile = qa('#main .tile').filter((x: W) => x.textContent.indexOf('Проєкт без погоджених') >= 0)[0];
  expect(tile.querySelector('.rep-ap').textContent).toContain('На погодженні');
});

// #51: проект с отчётом на погодженні всё же выбран в общей форме — пояснение сразу, сохранить нельзя
test('#51 общая форма: выбран проект с отчётом на погодженні — плашка, отчёт не сохраняется', () => {
  const f = openForm(); const sel = f.querySelector('select#f-p');
  const pend = (Array.from(sel.options) as W[]).filter(o => o.disabled)[0];
  expect(pend).toBeDefined();
  expect(f.querySelector('#f-pend').hidden).toBe(true);
  sel.value = pend.value; ev(sel, 'change');
  expect(f.querySelector('#f-pend').hidden).toBe(false);
  expect(f.querySelector('#f-pend').textContent).toContain('на погодженні');
  const before = qa('#main tbody tr').length;
  f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  expect(q('#repform')).not.toBeNull();
  expect(f.querySelector('.err').textContent).toContain('на погодженні');
  nav('reports'); expect(qa('#main tbody tr').length).toBe(before);
});

// #53: вне 0–100 — не заменяется молча: значение остаётся, ошибка у поля, отчёт не сохраняется
test.each(['500', '101'])('#53 прототип: «%s» в «% виконання» — ошибка у поля, без замены на 100', v => {
  const f = openForm(); const pr = f.querySelector('#f-pr');
  pr.focus(); pr.value = v; ev(pr, 'input'); pr.blur();
  expect(pr.value).toBe(v);
  f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  expect(q('#repform')).not.toBeNull();
  expect(pr.getAttribute('aria-invalid')).toBe('true');
  const e = f.querySelector('#e-pr'); expect(e.hidden).toBe(false); expect(e.textContent).toBe(T.errProgress[0]);
});

// #45: «Бюджет (план), $» — с пробелами между разрядами (новый проект — поле; карточка — только просмотр)
test('#45 прототип: бюджет нового проекта и в карточке — с разрядами', () => {
  nav('projects'); q('[data-act="openp"][data-id="1"]').click(); q('[data-act="editproj"][data-id="1"]').click();
  const fx = q('#p-budget-fixed'); expect(fx).not.toBeNull();
  expect(fx.textContent.replace(/\s/g, ' ')).toMatch(/^\d{1,3}( \d{3})+ \$$/);
  asUser('Олександра Мороз'); nav('projects'); q('[data-act="newproj"]').click();
  const b = q('#pform #p-budget'); b.focus(); b.value = '2400000'; ev(b, 'input'); b.blur();
  expect(b.value).toBe('2 400 000');
});

// #30: суммы — в долларах
test('#30 прототип: суммы в списке проектов — в долларах', () => {
  nav('projects'); listMode('projMode');
  q('[data-act="tcols"]').click();
  const cb = q('#pop input[type="checkbox"][data-col="budget"], #pop [data-act="ctoggle"][data-col="budget"]');
  if (cb && !cb.checked) cb.click();
  const money = qa('#main table td').map((td: W) => td.textContent.trim()).filter((s: string) => /\d \$$|^\d+ \$$/.test(s.replace(/\s/g, ' ')));
  expect(money.length).toBeGreaterThan(0);
  expect(qa('#main table td').some((td: W) => /грн|₴/.test(td.textContent))).toBe(false);
});

// #36: «Я PM» и «Мої проєкти (усі)» — и в «Архіві»
test('#36 прототип «Архів»: виды «Мої проєкти (усі)» и «Я PM»; «Я PM» ⊆ «Мої проєкти (усі)»', () => {
  nav('archive'); listMode('archMode');
  const opts = (Array.from(q('select[data-act="view"]').options) as W[]).map(o => o.value);
  expect(opts).toEqual(expect.arrayContaining(['mine', 'pm']));
  const ids = (v: string): number[] => { setView(v); return Array.from(new Set(qa('#main [data-act="openp"]').map((x: W) => Number(x.dataset.id)))); };
  const mine = ids('mine'), pm = ids('pm');
  pm.forEach(id => expect(mine).toContain(id));
});

// #32: риск архивного проекта с вкладки «Ризики» — только просмотр
test('#32 прототип: риск из «Ризики архівних проєктів» открывается только для просмотра', () => {
  nav('risks'); setView('archived');
  const open = q('#main table [data-act="riskopen"]'); expect(open).not.toBeNull(); open.click();
  const f = q('#kform'); expect(f).not.toBeNull();
  expect(f.querySelector('button[type="submit"]')).toBeNull();
  expect(f.querySelector('#k-status').disabled).toBe(true);
});

// #49: ширина колонок — во всех пяти списках; порядок — ↑ / ↓ в меню колонок, запоминается для списка
test.each([['projects', 'projMode'], ['archive', 'archMode'], ['reports', ''], ['risks', ''], ['feedback', '']])('#49 прототип: «%s» — у колонок есть ручка ширины', (page, mode) => {
  nav(page); if (mode) listMode(mode as string);
  q('#main .dt [data-act="tsort"]').click();   // перерисовка без перехода: ширины закреплены по первой раскладке
  expect(q('#main .dt .col-rs')).not.toBeNull();
});
test('#49 прототип: ↓ в меню колонок меняет порядок, порядок запомнен для этого списка', () => {
  nav('risks');
  const heads = (): string[] => qa('#main .dt thead th').map((th: W) => th.textContent.trim());
  const key = q('#main .dt[data-tkey]').dataset.tkey;
  const h0 = heads();
  q('[data-act="tcols"]').click();
  const down = qa('#pop [data-act="cmove"][data-dir="1"]').filter((b: W) => !b.disabled)[1];   // [0] — первая колонка (см. тест расхождения ниже)
  const col = down.dataset.col; down.click();
  const h1 = heads();
  expect(h1).not.toEqual(h0);
  expect(h1.slice().sort()).toEqual(h0.slice().sort());
  const saved = JSON.parse(w.localStorage.getItem('pmo-table5-' + key));
  const i = saved.cols.indexOf(col); expect(i).toBeGreaterThan(0);
  expect(saved.cols[i - 1]).toBeDefined();
  nav('reports'); nav('risks');
  expect(heads()).toEqual(h1);   // после ухода и возврата — тот же порядок
});

// Расхождения, найденные сверкой (минорные): исправлены 02.11.2026
// Найдено сверкой 02.11.2026, исправлено: прототип закрывает «Зберегти» (pendLock) при отчёте на погодженні, но перерисовка помощника ИИ (render в aiFormInit,
// sub.disabled = b === 'busy') тут же открывает кнопку снова; сохранение всё равно отклоняется при отправке. В приложении кнопка не закрывается вовсе.
test(' #51 прототип: при выбранном проекте с отчётом на погодженні кнопка «Зберегти» закрыта', () => {
  const f = openForm(); const sel = f.querySelector('select#f-p');
  const pend = (Array.from(sel.options) as W[]).filter(o => o.disabled)[0];
  sel.value = pend.value; ev(sel, 'change');
  expect(f.querySelector('#f-submit').disabled).toBe(true);
});
// Найдено сверкой 02.11.2026, исправлено #49: у первой колонки (не закреплённой) кнопка «↓» в меню колонок активна; прототип по нажатию ничего не делает (i > 0),
// а приложение (logic/table.ts moveCol: проверяется только j >= 1) переставляет её — первой становится другая колонка. Ожидаемо: «↓» у первой колонки закрыта.
test(' #49 прототип: «↓» у первой колонки закрыта (на первую позицию ничего не сдвигается)', () => {
  nav('risks'); q('[data-act="tcols"]').click();
  const first = qa('#pop .col-row')[0];
  expect(first.querySelector('[data-act="cmove"][data-dir="1"]').disabled).toBe(true);
});
