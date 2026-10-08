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
  // архив — по статусу: проект «Скасовано» (не «Архівний»), в представлении «Скасовані», не в «Завершені»
  expect(q('#panel').textContent).toContain('Скасовано'); expect(q('#panel').textContent).not.toContain('Архівний');
  q(`[data-act="nav"][data-page="archive"]`).click();
  const sel = q('select[data-act="view"]');
  sel.value = 'cancelled'; ev(sel, 'change'); expect(q(`#main [data-act="openp"][data-id="${pid}"]`)).not.toBeNull();
  const s2 = q('select[data-act="view"]'); s2.value = 'done'; ev(s2, 'change'); expect(q(`#main [data-act="openp"][data-id="${pid}"]`)).toBeNull();
  // в «Проєкти» его нет
  q('[data-act="nav"][data-page="projects"]').click(); expect(q(`#main [data-act="openp"][data-id="${pid}"]`)).toBeNull();
});

describe('#43 смена PM / власника — только PMO', () => {
  const card = (id: number): void => { q('[data-act="nav"][data-page="projects"]').click(); q(`[data-act="openp"][data-id="${id}"]`).click(); };
  test('PM: кнопки нет, в форме проекта PM и власник — только чтение', () => {
    card(1);                                                     // PRJ-001: PM — Юрій (текущий пользователь)
    expect(q('[data-act="assign"]')).toBeNull();
    q('[data-act="editproj"][data-id="1"]').click();
    expect(q('#pform select#p-pm')).toBeNull();
    expect(q('#p-pm-fixed').textContent).toBe('Юрій');
    expect(q('#pform').textContent).toContain('PM і власника змінює лише PMO.');
  });
  test('PMO: без выбора и без причины — ошибки; затем новый PM в карточке и «Призначення» в истории', () => {
    asPmo(); card(1);
    q('[data-act="assign"][data-id="1"]').click();
    const f = q('#aform'); const submit = (): void => { f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); };
    submit(); expect(err(f)).toBe('Оберіть нового PM або нового власника.');
    const pm = f.querySelector('#a-pm'); pm.value = 'Андрій Мельник'; ev(pm, 'change');
    submit(); expect(err(f)).toBe('Вкажіть причину зміни.');
    f.querySelector('#a-note').value = 'Ротація PM'; submit();
    expect(q('#aform')).toBeNull();
    const txt = q('#panel, .panel, body').textContent;
    expect(txt).toContain('Андрій Мельник');
    q('[data-act="togglech"]') && q('[data-act="togglech"]').click();
    expect(w.document.body.textContent).toContain('Призначення');
    expect(w.document.body.textContent).toContain('Ротація PM');
  });
  test('PMO: архивный проект — кнопки нет', () => {
    asPmo();
    q('[data-act="nav"][data-page="archive"]').click();
    const a = q('[data-act="openp"]'); expect(a).not.toBeNull(); a.click();
    expect(q('[data-act="assign"]')).toBeNull();
  });
});

describe('#46 / #48 события отчётов и рисков в истории', () => {
  const asUser = (n: string): void => { const b = w.document.createElement('button'); b.dataset.act = 'asuser'; b.dataset.n = n; w.document.body.appendChild(b); b.click(); b.remove(); };
  const card = (id: number): void => { q('[data-act="nav"][data-page="projects"]').click(); q(`[data-act="openp"][data-id="${id}"]`).click(); };
  const history = (): string => { const b = q('[data-act="togglech"]'); if (b && /\(/.test(b.textContent)) b.click(); return (q('#panel') || w.document.body).textContent; };
  const fillReport = (f: W, title: string): void => {
    ['sched', 'budget', 'res'].forEach(n => { const r = f.querySelector(`input[name="${n}"][value="Зелений"]`); r.checked = true; ev(r, 'change'); });
    const t = f.querySelector('#f-t'); t.value = title; ev(t, 'input');
    const kr = f.querySelector('#f-kr'); if (kr) { kr.value = 'Причина'; ev(kr, 'input'); }
    f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  };
  test('#46 «Новий звіт на основі повернутого» — событие со ссылкой на отчёт', () => {
    asUser('Ірина Бондаренко'); card(3);
    q('[data-act="newfromret"][data-id="3"]').click();
    fillReport(q('#repform'), 'Виправлений звіт');
    expect(q('#repform')).toBeNull();
    card(3);
    const h = history();
    expect(h).toContain('Подання звіту');
    expect(h).toMatch(/Новий звіт на основі повернутого від \d\d\.\d\d\.\d{4} · Виправлений звіт/);
    const link = Array.from(w.document.querySelectorAll('.chg-ref[data-act="repopen"]'))[0] as W;
    expect(link).toBeDefined(); link.click();
    expect(q('#panel .ph h2, .ph h2').textContent).toBe('Виправлений звіт');
  });
  test('#48 риск: «Додано», затем «Закрито» с изменением оценки; ссылка открывает риск', () => {
    card(1);
    q('[data-act="newrisk"][data-id="1"]').click();
    let f = q('#kform');
    f.querySelector('#k-title').value = 'Новий ризик історії'; ev(f.querySelector('#k-title'), 'input');
    f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    card(1);
    expect(history()).toContain('Додано: Новий ризик історії');
    const open = Array.from(w.document.querySelectorAll('.chg-ref[data-act="riskopen"]'))[0] as W;
    expect(open).toBeDefined(); open.click();
    f = q('#kform');
    expect(f.querySelector('#k-title').value).toBe('Новий ризик історії');
    const st = f.querySelector('#k-status'); st.value = 'Закрито'; ev(st, 'change');
    const pr = f.querySelector('input[name="k-pr"][value="5"]'); pr.checked = true; ev(pr, 'change');
    f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    card(1);
    const h = history();
    expect(h).toContain('Закрито: Новий ризик історії');
    expect(h).toMatch(/Ймовірність\s*3\s*→\s*5/);
    expect(h).toMatch(/Оцінка\s*9\s*→\s*15/);
  });
});

describe('сповіщення: колокольчик в прототипе', () => {
  const asUser = (n: string): void => { const b = w.document.createElement('button'); b.dataset.act = 'asuser'; b.dataset.n = n; w.document.body.appendChild(b); b.click(); b.remove(); };
  const dot = (): boolean => !!q('#bell .dot-new');
  const comment = (pid: number, txt: string): void => {
    q('[data-act="nav"][data-page="projects"]').click(); q(`[data-act="openp"][data-id="${pid}"]`).click();
    const ta = q('#panel textarea, .panel textarea, textarea'); ta.value = txt; ev(ta, 'input');
    ta.closest('form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  };
  test('после загрузки точки нет; комментарий PM — точка у власника, не у постороннего; «Позначити все прочитаним» гасит точку', () => {
    expect(dot()).toBe(false);
    comment(1, 'Перевірка сповіщень');                      // PRJ-001: PM — Юрій, власник — Сергій Литвиненко
    expect(dot()).toBe(false);                               // своё — не новое
    asUser('Наталія Шевчук'); expect(dot()).toBe(false);     // PM другого проекта — не участник PRJ-001
    asUser('Сергій Литвиненко'); expect(dot()).toBe(true);
    q('#bell').click();
    expect(w.document.body.textContent).toContain('Перевірка сповіщень');
    expect(q('.ntf-i.new')).not.toBeNull();
    expect(dot()).toBe(true);                                // открытие ничего не отмечает
    // «Лише нові» — новые видны и выделены
    const cb = q('#ntf-new'); cb.checked = true; ev(cb, 'change');
    expect(q('.ntf-i.new')).not.toBeNull();
    expect(w.document.body.textContent).toContain('Перевірка сповіщень');
    // переход к событию — вверху «← Сповіщення»; возврат — список с тем же выделением «Нове»
    q('.ntf-i.new').click();
    expect(q('[data-act="notifback"]')).not.toBeNull();
    q('[data-act="notifback"]').click();
    expect(q('#ntf-list')).not.toBeNull(); expect(q('.ntf-i.new')).not.toBeNull();
    q('#ntf-all').click();
    expect(dot()).toBe(false); expect(q('.ntf-i.new')).toBeNull(); expect(q('#ntf-all')).toBeNull();
    // открытие из шапки — без кнопки возврата
    q('#bell').click(); expect(q('[data-act="notifback"]')).toBeNull();
  });
  test('число новых на колокольчике', () => {
    comment(1, 'Перше'); comment(1, 'Друге');
    asUser('Сергій Литвиненко'); expect(q('#bell .dot-new').textContent).toBe('2'); expect(q('#bell').classList.contains('has')).toBe(true);
  });
  test('видит проект, но не по своей роли (руководитель власника) — точки нет', () => {
    asUser('Андрій Мельник'); comment(2, 'Коментар PM');        // PRJ-002: PM — Андрій Мельник, власник — Юрій
    asUser('Сергій Литвиненко');                                  // руководитель Юрія: видит проект, сповіщень не получает
    q('[data-act="nav"][data-page="projects"]').click();
    expect(q('[data-act="openp"][data-id="2"]')).not.toBeNull();
    expect(dot()).toBe(false);
    asUser('Юрій'); expect(dot()).toBe(true);
  });
});

describe('прототип: метка погодження в колонке «Звіт»', () => {
  test('у каждого проекта с отчётами — метка самого нового отчёта; на погодженні — с датой', () => {
    q('[data-act="nav"][data-page="projects"]').click();
    const tiles = Array.from(w.document.querySelectorAll('#main .tile .rep-ap'));
    q('[data-act="mode"][data-key="projMode"][data-mode="list"]').click();
    const marks = Array.from(w.document.querySelectorAll('#main table .rep-ap')) as any[];
    expect(tiles.length + marks.length).toBeGreaterThan(marks.length);   // и на плитках, и в таблице
    expect(marks.length).toBeGreaterThan(0);
    const txt = marks.map(m => m.textContent).join('|');
    expect(txt).toContain('Погоджено');
    const pend = marks.filter(m => m.textContent.indexOf('На погодженні') >= 0);
    pend.forEach(m => expect(m.querySelector('.muted')).not.toBeNull());
    // подсказка к точке свежести — у каждой ячейки «Звіт»
    const rags = Array.from(w.document.querySelectorAll('#main table .rag[title]')) as any[];
    expect(rags.length).toBeGreaterThanOrEqual(marks.length);   // и без отчётов — подсказка «ще немає»
    expect(rags.some(r => /дн\. тому/.test(r.getAttribute('title')))).toBe(true);
  });
});
