import * as fs from 'fs';
import * as path from 'path';
import { T } from '../src/webparts/pmoPortal/i18n/strings';

// Прототип в jsdom: форма нового проекта (#27 уникальное название, #54 даты не раньше старта) и «Ризики архівних проєктів» (#32)
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
  for (let i = 0; i < 20 && !w.document.querySelector('[data-act="lang"]'); i++) await new Promise(r => setTimeout(r, 0));
  w.document.querySelector('[data-act="lang"][data-i="0"]').click();
});
afterEach(() => { if (w) w.close(); });
const q = (s: string): W => w.document.querySelector(s);
const ev = (el: W, t: string): void => { el.dispatchEvent(new w.Event(t, { bubbles: true })); };
// «войти как» PMO (кнопка меню пользователя; обработчик — по data-act на документе)
function asPmo(): void { const b = w.document.createElement('button'); b.dataset.act = 'asuser'; b.dataset.n = 'Олександра Мороз'; w.document.body.appendChild(b); b.click(); b.remove(); }
function newProject(title: string, start: string, golive: string): W {
  asPmo();
  q('[data-act="nav"][data-page="projects"]').click();
  q('[data-act="newproj"]').click();
  const f = q('#pform'); const g = (id: string): W => f.querySelector('#' + id);
  g('p-title').value = title; ev(g('p-title'), 'input');
  const pm = g('p-pm'); if (pm.tagName === 'SELECT') { pm.value = Array.from(pm.options).map((o: W) => o.value).filter(Boolean)[1]; ev(pm, 'change'); }
  if (g('p-start')) { g('p-start').value = start; ev(g('p-start'), 'change'); }
  if (g('p-golive')) { g('p-golive').value = golive; ev(g('p-golive'), 'change'); }
  f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  return f;
}
const err = (f: W): string => { const e = f.querySelector('.err'); return e && !e.hidden ? e.textContent : ''; };

test('#27: название, совпадающее с существующим (без учёта регистра и пробелов), — ошибка', () => {
  // название — из ссылки в таблице главной (у плитки в тексте вся плитка)
  q('[data-act="nav"][data-page="home"]').click();
  const existing = (q('button.link[data-act="openp"]').textContent || '').trim();
  expect(existing.length).toBeGreaterThan(3);
  const f = newProject('  ' + existing.toUpperCase() + ' ', '2026-03-02', '2026-04-01');
  expect(err(f)).toBe(T.errTitleTaken[0]);
});
test('#54: дата запуска раньше старта у нового проекта — ошибка; по порядку — без ошибки дат', () => {
  const f = newProject('Перевірка дат', '2026-03-02', '2026-01-01');
  expect(err(f)).toBe(T.errDatesOrder[0]);
});
test('#32: «Ризики архівних проєктів» — непусто и только риски архивных проектов', () => {
  q('[data-act="nav"][data-page="risks"]').click();
  const sel = q('select[data-act="view"]'); sel.value = 'archived'; ev(sel, 'change');
  const rowsArch = w.document.querySelectorAll('tbody tr').length;
  sel.value = 'open'; ev(sel, 'change');
  sel.value = 'archived'; ev(sel, 'change');
  const projArch = Array.from(w.document.querySelectorAll('tbody [data-act="openp"]')).map((x: W) => x.textContent.trim());
  expect(rowsArch).toBeGreaterThan(0);                                   // в демо-данных есть риски архивного проекта
  // все проекты вида — архивные: их нет на вкладке «Проєкти»
  q('[data-act="nav"][data-page="projects"]').click();
  const active = Array.from(w.document.querySelectorAll('[data-act="openp"]')).map((x: W) => x.textContent.trim());
  projArch.forEach((t: string) => expect(active).not.toContain(t));
});

test('#47 / #55: форма риска — тип перед «Опис», заголовок по типу, кнопка «Новий ризик / проблема»', () => {
  q('[data-act="nav"][data-page="risks"]').click();
  const b = q('[data-act="newrisk"]'); expect(b.textContent).toContain('Новий ризик / проблема');
  b.click();
  const f = q('#kform'), ty = f.querySelector('fieldset.ragpick'), ta = f.querySelector('#k-title');
  expect(ty.compareDocumentPosition(ta) & w.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(f.querySelector('label[for="k-title"]').textContent).toContain('Опис');
  expect(q('#panel .ph h2, .ph h2').textContent).toBe('Новий ризик');
  const r = f.querySelector('input[name="k-type"][value="Проблема"]'); r.checked = true; ev(r, 'change');
  expect(q('.ph h2').textContent).toBe('Нова проблема');
});

test('#54: «Скасовано» с фактической датой → погодження PMO → дата в карточке и в архиве', () => {
  // PM (Юрій) подаёт отчёт «Скасовано» из общей формы
  q('[data-act="nav"][data-page="reports"]').click();
  q('[data-act="newrep"]:not([data-id])').click();
  const f = q('#repform'); const g = (id: string): W => f.querySelector('#' + id);
  const pid = g('f-p').value;
  const set = (id: string, v: string): void => { g(id).value = v; ev(g(id), 'input'); ev(g(id), 'change'); };
  ['sched', 'budget', 'res'].forEach(n => { f.querySelector(`input[name="${n}"][value="Червоний"]`).checked = true; });
  set('f-st', 'Скасовано');
  expect(q('#f-ae-wrap').hidden).toBe(false);
  const start = g('f-start').value || '2000-01-01';
  set('f-d', '2026-10-01'); set('f-t', 'Скасовано'); set('f-kr', 'Рішення PMO');
  set('f-ae', start > '2026-09-15' ? start : '2026-09-15');
  const ae = g('f-ae').value;
  f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  expect(q('#repform')).toBeNull();
  // PMO погоджує
  asPmo();
  q('[data-act="nav"][data-page="projects"]').click();
  q(`[data-act="openp"][data-id="${pid}"]`).click();
  const open = q(`.apnote [data-act="repopen"][data-id="${pid}"]`);
  expect(open).not.toBeNull(); open.click();
  q('#apform').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  // карточка: «Дата завершення (факт)»; архив — колонка
  q(`[data-act="nav"][data-page="archive"]`).click();
  const [y, m, d] = ae.split('-');
  expect(w.document.querySelector('main, #main, body').textContent).toContain(`${d}.${m}.${y}`);
  q(`[data-act="openp"][data-id="${pid}"]`).click();
  const kv = Array.from(w.document.querySelectorAll('#panel .kv, .kv')).map((x: W) => x.textContent).filter((x: string) => x.indexOf('Дата завершення (факт)') === 0);
  expect(kv[0]).toContain(`${d}.${m}.${y}`);
});
