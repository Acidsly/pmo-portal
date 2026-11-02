import * as fs from 'fs';
import * as path from 'path';
import { T } from '../src/webparts/pmoPortal/i18n/strings';

// Финансы и власник ризику (#111 / #121 / #123, #122, #137, #129) — прототип в jsdom через интерфейс; каждый тест — на свежем прототипе
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JSDOM } = require('jsdom');
const HTML = fs.readFileSync(path.join(__dirname, '../../prototype/pmo-prototype.html'), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = any;
let w: W;
beforeEach(async () => {
  w = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://pmo.test/', beforeParse(win: W) {
    win.matchMedia = () => ({ matches: false, addEventListener() { /* */ }, removeEventListener() { /* */ }, addListener() { /* */ } });
    win.HTMLElement.prototype.scrollIntoView = function (): void { /* */ }; win.scrollTo = () => undefined; win.confirm = () => true; } }).window;
  for (let i = 0; i < 20 && !w.document.querySelector('[data-act="lang"]'); i++) await new Promise(r => setTimeout(r, 0));
  w.document.querySelector('[data-act="lang"][data-i="0"]').click();
});
afterEach(() => { if (w) w.close(); });
const q = (s: string): W => w.document.querySelector(s);
const ev = (el: W, t: string): void => { el.dispatchEvent(new w.Event(t, { bubbles: true })); };
const set = (el: W, v: string): void => { el.value = v; ev(el, 'input'); ev(el, 'change'); };
function openReport(): W { q('[data-act="nav"][data-page="reports"]').click(); q('[data-act="newrep"]:not([data-id])').click(); return q('#repform'); }
const shown = (el: W): string => (el && !el.hidden ? el.textContent : '');
const na = (f: W): W => f.querySelector('input[name="budget"][value="Не оцінено"]');
const naVisible = (f: W): boolean => !na(f).hidden && !f.querySelector(`label[for="${na(f).id}"]`).hidden;

describe('#121 «Не оцінено» в оценке «Бюджет»', () => {
  test('варіант видно лише в «Ініціація» / «Планування»; інша фаза знімає вибір', () => {
    const f = openReport(); const st = f.querySelector('#f-st');
    set(st, 'Планування'); expect(naVisible(f)).toBe(true);
    na(f).checked = true; ev(na(f), 'change');
    set(st, 'Реалізація');
    expect([na(f).checked, naVisible(f)]).toEqual([false, false]);
    set(st, 'Ініціація'); expect(naVisible(f)).toBe(true);
  });
  test('загальний стан з «Не оцінено» — з двох інших оцінок', () => {
    const f = openReport(); set(f.querySelector('#f-st'), 'Планування');
    const pick = (n: string, v: string): void => { const x = f.querySelector(`input[name="${n}"][value="${v}"]`); x.checked = true; ev(x, 'change'); };
    pick('sched', 'Жовтий'); pick('budget', 'Не оцінено'); pick('res', 'Зелений');
    expect(q('#f-ragv').textContent).toContain('Жовтий');
  });
});

describe('#111 / #123 порожні суми', () => {
  test('очистили суму й вийшли з поля — порожньо, а не «0»', () => {
    const f = openReport(); const c = f.querySelector('#f-c');
    c.focus(); c.value = ''; ev(c, 'input'); c.blur();
    expect(c.value).toBe('');
    c.focus(); c.value = '0'; ev(c, 'input'); c.blur();
    expect(c.value).toBe('');
  });
  test('#122: підказка — усі витрати проєкту разом', () => {
    expect(openReport().textContent).toContain(T.costHint[0]);
    expect(T.costHint[0]).toContain('Усі витрати проєкту разом');
  });
});

test('#137 прототип: підказка під «Бюджет» за правилом PMO; зеленіша оцінка — попередження', () => {
  const f = openReport();
  set(f.querySelector('#f-st'), 'Реалізація');
  const bp = f.querySelector('#f-bp'), fc = f.querySelector('#f-fcost');
  set(bp, '1000'); set(fc, '1100');
  expect(shown(f.querySelector('#w-budget'))).toBe(T.hintBudgetRule[0].replace('{n}', '10').replace('{rag}', 'червоний'));
  const g = f.querySelector('input[name="budget"][value="Зелений"]'); g.checked = true; ev(g, 'change');
  expect(shown(f.querySelector('#w-budget'))).toBe(T.warnBudgetRule[0].replace('{n}', '10').replace('{rag}', 'червоний'));
  set(fc, '1050');
  expect(shown(f.querySelector('#w-budget'))).toBe(T.warnBudgetRule[0].replace('{n}', '5').replace('{rag}', 'жовтий'));
  set(fc, '900');
  expect(shown(f.querySelector('#w-budget'))).toBe('');
});

test('#129 прототип: власник обов’язковий — «*», за замовчуванням PM; без власника — помилка біля поля', () => {
  q('[data-act="nav"][data-page="risks"]').click(); q('[data-act="newrisk"]').click();
  const f = q('#kform');
  expect(f.querySelector('label[for="k-owner"]').textContent).toMatch(/\*$/);
  expect(f.querySelector('#k-owner').value).not.toBe('');
  const o = f.querySelector('#k-owner'); o.value = ''; ev(o, 'change');
  f.querySelector('#k-title').value = 'Ризик'; ev(f.querySelector('#k-title'), 'input');
  f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  expect(shown(f.querySelector('#k-owner-e'))).toBe(T.errRiskOwner[0]);
});
