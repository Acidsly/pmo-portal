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
function asUser(n: string): void { const b = w.document.createElement('button'); b.dataset.act = 'asuser'; b.dataset.n = n; w.document.body.appendChild(b); b.click(); b.remove(); }
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
/** #91: обязательные поля новой записи реестра — стратегия, заходи, план дій. */
function fillRisk(f: W, o: { strategy?: string; mit?: string; cont?: string } = {}): void {
  const s = f.querySelector(`input[name="k-str"][value="${o.strategy || 'Прийняття'}"]`); s.checked = true; ev(s, 'change');
  for (const [id, v] of [['k-mit', o.mit || 'Заходи'], ['k-cont', o.cont || 'План дій']]) { const t = f.querySelector('#' + id); t.value = v; ev(t, 'input'); }
}

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
  // метка сущности окна меняется вместе с типом
  expect(q('.ph .ent').textContent).toBe('Проблема');
});

test('метка сущности бокового окна: проект, статус-звіт, ризик — откуда бы ни открыли', () => {
  q('[data-act="nav"][data-page="projects"]').click(); q('[data-act="openp"][data-id="1"]').click();
  expect(q('#panel .ph .ent').textContent).toBe('Проєкт');
  q('[data-act="nav"][data-page="reports"]').click(); const rep = q('#main [data-act="repopen"]'); rep.click();
  expect(q('#panel .ph .ent').textContent).toBe('Статус-звіт');
  q('[data-act="nav"][data-page="risks"]').click(); const rk = q('#main [data-act="riskopen"]'); rk.click();
  expect(['Ризик', 'Проблема']).toContain(q('#panel .ph .ent').textContent);
  q('#bell').click(); expect(q('#panel .ph .ent').textContent).toBe('Сповіщення');
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
  set('f-t', 'Скасовано'); set('f-kr', 'Рішення PMO');
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

test('#96: правка карточки без «Мета та опис» — ошибка у поля; новый проект PMO — без описания можно', () => {
  q('[data-act="nav"][data-page="projects"]').click(); q('[data-act="openp"][data-id="1"]').click();
  q('[data-act="editproj"][data-id="1"]').click();
  const f = q('#pform'); expect(f.querySelector('label[for="p-desc"]').textContent).toBe('Мета та опис *');
  const d = f.querySelector('#p-desc'); d.value = '   '; ev(d, 'input');
  f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  expect(err(f)).toBe(T.errDesc[0]); expect(d.getAttribute('aria-invalid')).toBe('true'); expect(f.querySelector('#e-desc').hidden).toBe(false);
  const nf = newProject('Проєкт без опису', '2026-03-02', '2026-04-01');
  expect(nf.querySelector('label[for="p-desc"]').textContent).toBe('Мета та опис');
  expect(err(nf)).not.toBe(T.errDesc[0]);
});

describe('#43 смена PM / власника — только PMO', () => {
  const card = (id: number): void => { q('[data-act="nav"][data-page="projects"]').click(); q(`[data-act="openp"][data-id="${id}"]`).click(); };
  test('PM (не PMO и не владелец сайта): кнопки нет, в форме проекта PM и власник — только чтение', () => {
    asUser('Андрій Мельник'); card(2);                           // PRJ-002: PM — Андрій Мельник
    expect(q('[data-act="assign"]')).toBeNull();
    q('[data-act="editproj"][data-id="2"]').click();
    expect(q('#pform select#p-pm')).toBeNull();
    expect(q('#p-pm-fixed').textContent).toBe('Андрій Мельник');
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
    f.querySelector('#k-title').value = 'Новий ризик історії'; ev(f.querySelector('#k-title'), 'input'); fillRisk(f);
    f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    card(1);
    expect(history()).toContain('Додано: Новий ризик історії');
    const open = Array.from(w.document.querySelectorAll('.chg-ref[data-act="riskopen"]'))[0] as W;
    expect(open).toBeDefined(); open.click();
    f = q('#kform');
    expect(f.querySelector('#k-title').value).toBe('Новий ризик історії');
    // #92: в сохранённой записи меняется только статус — оценку не изменить
    expect(f.querySelector('input[name="k-pr"][value="5"]').disabled).toBe(true);
    const st = f.querySelector('#k-status'); st.value = 'Закрито'; ev(st, 'change');
    f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    card(1);
    const h = history();
    expect(h).toContain('Закрито: Новий ризик історії');
    expect(h).toMatch(/Статус\s*Відкрито\s*→\s*Закрито/);
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
    // переход к событию — вверху «← Сповіщення»; открытое событие прочитано, точка гаснет
    q('.ntf-i.new').click();
    expect(q('[data-act="notifback"]')).not.toBeNull();
    expect(dot()).toBe(false);
    q('[data-act="notifback"]').click();
    expect(q('#ntf-list')).not.toBeNull(); expect(q('.ntf-i.new')).toBeNull();
    // открытие из шапки — без кнопки возврата
    q('#bell').click(); expect(q('[data-act="notifback"]')).toBeNull();
  });
  test('число новых на колокольчике', () => {
    comment(1, 'Перше'); comment(1, 'Друге');
    asUser('Сергій Литвиненко'); expect(q('#bell .dot-new').textContent).toBe('2'); expect(q('#bell').classList.contains('has')).toBe(true);
    // открыл одно — прочитано оно, второе осталось новым
    q('#bell').click(); expect(q('#ntf-n').textContent).toBe('Нових: 2'); q('.ntf-i.new').click();
    expect(q('#bell .dot-new').textContent).toBe('1');
    q('[data-act="notifback"]').click();
    expect(w.document.querySelectorAll('.ntf-i.new').length).toBe(1);
    expect(q('#ntf-n').textContent).toBe('Нових: 1');
    // «Позначити все прочитаним» — всё
    q('#ntf-all').click();
    expect(q('#bell .dot-new')).toBeNull(); expect(q('.ntf-i.new')).toBeNull(); expect(q('#ntf-all')).toBeNull();
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

test('меню прототипа: значок и название у каждой вкладки, цвета разделов в обеих темах', () => {
  const bs = Array.from(w.document.querySelectorAll('.nav button')) as W[];
  expect(bs.length).toBeGreaterThan(4);
  bs.forEach(b => { expect(b.querySelector('.ni svg')).not.toBeNull(); expect(b.querySelector('.nl').textContent).toBe(b.title); });
  const css = Array.from(w.document.querySelectorAll('style')).map((x: W) => x.textContent).join('\n');
  for (const k of ['home', 'projects', 'reports', 'risks', 'archive', 'feedback']) expect((css.match(new RegExp(`--nv-${k}:`, 'g')) || []).length).toBe(3);   // светлая и две тёмные
  expect(css).toMatch(/@media \(max-width:720px\)\{[^\n]*\.nav button\{[^}]*\}\.nav \.nl\{display:none\}/);
});

test('шапка: название — своей строкой, ниже меню и кнопки; на телефоне меню отдельной строкой (перекрытие на 1440 px)', () => {
  const css = Array.from(w.document.querySelectorAll('style')).map((x: W) => x.textContent).join('\n');
  expect(css).toMatch(/\.brand\{[^}]*flex:1 0 100%\}/);
  // меню по ширине своих разделов (без пустого места справа), сжимается и прокручивается внутри — кнопки не уходят ниже
  expect(css).toMatch(/\.nav\{[^}]*flex:0 1 auto;min-width:0\}/);
  // меню своей строкой — разделы делят ширину поровну
  expect(css).toMatch(/@media \(max-width:1279px\)\{\.nav\{order:3;flex:1 0 100%\}\.nav button\{flex:1 1 auto;justify-content:center\}\}/);
  const ov = fs.readFileSync(path.join(__dirname, '../src/webparts/pmoPortal/theme/overrides.scss'), 'utf8');
  expect(ov).not.toMatch(/\.pmo-app \.brand \{ flex:/);   // приложение не меняет строку названия
  expect(ov).not.toMatch(/\.top-in \{ flex-wrap: nowrap/);  // название и меню в одну строку — не помещается
});

test('#73 фильтр колонки «Звіт»: свежесть и погодження; «Погоджено» — только такие проекты', () => {
  q('[data-act="nav"][data-page="projects"]').click();
  q('[data-act="mode"][data-key="projMode"][data-mode="list"]').click();
  q('[data-act="tfilter"][data-col="repDate"]').click();
  const vals = Array.from(w.document.querySelectorAll('#pop [data-pv]')).map((x: W) => x.dataset.pv);
  expect(vals).toEqual(expect.arrayContaining(['0', 'a1']));
  expect(w.document.querySelector('#pop').textContent).toContain('Погоджено');
  const cb = q('#pop [data-pv="a1"]'); cb.checked = true; ev(cb, 'change');
  const marks = Array.from(w.document.querySelectorAll('#main table tbody tr')).map((tr: W) => (tr.querySelector('.rep-ap') || { textContent: '' }).textContent);
  expect(marks.length).toBeGreaterThan(0);
  marks.forEach((m: string) => expect(m).toContain('Погоджено'));
});

test('#63 переключатели форм: выбранный — рамка темы и ✓, наведение и «недоступно»; невыбранные в тёмной теме светлее', () => {
  const css = Array.from(w.document.querySelectorAll('style')).map((x: W) => x.textContent).join('\n');
  expect(css).toMatch(/\.ragpick input:checked \+ label\{[^}]*inset 0 0 0 2px var\(--theme\)/);
  expect(css).toMatch(/\.ragpick input:checked \+ label::before\{content:'✓'/);
  expect(css).toMatch(/\.ragpick input:not\(:checked\):not\(:disabled\) \+ label:hover\{/);
  expect(css).toMatch(/\.ragpick input:disabled \+ label\{opacity:\.5/);
  expect((css.match(/--pick-off:/g) || []).length).toBe(3);   // светлая и две тёмные
  expect(css).toMatch(/--pick-off:rgba\(255,255,255,\.07\)/);
});

test('#71 прототип: «Мета та опис» — clamp и «Показати повністю» / «Згорнути»', () => {
  // PM (Юрій) записывает в PRJ-001 длинную «Мета та опис» с переносами строк
  q('[data-act="nav"][data-page="projects"]').click(); q('[data-act="openp"][data-id="1"]').click();
  q('[data-act="editproj"][data-id="1"]').click();
  const ta = q('#pform textarea#p-desc'); ta.value = 'Мета\n' + 'рядок опису\n'.repeat(20); ev(ta, 'input');
  q('#pform').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  q('[data-act="openp"][data-id="1"]').click();
  const ds = q('#card-desc'); expect(ds).not.toBeNull();
  expect(ds.className).toContain('clamp'); expect(ds.textContent).toContain('\n');
  const b = q('#desc-more'); b.hidden = false; b.click();
  expect(q('#card-desc').className).not.toContain('clamp'); expect(q('#desc-more').textContent).toBe('Згорнути');
  q('#desc-more').click(); expect(q('#card-desc').className).toContain('clamp');
});

test('#72 телефон: главная кнопка списка — на всю ширину, кнопки карточки и форм — по центру поровну', () => {
  const css = Array.from(w.document.querySelectorAll('style')).map((x: W) => x.textContent).join('\n');
  expect(css).toMatch(/@media \(max-width:720px\)\{\.cmdbar \.cmd\.primary\{flex:1 1 100%;justify-content:center\}/);
  expect(css).toMatch(/\.actbar \.btn\{flex:1 1 100%;justify-content:center\}/);
  expect(css).toMatch(/\.actions \.btn\{flex:1 1 120px;justify-content:center;white-space:nowrap\}/);
});

describe('раунд 5: прототип', () => {
  const openCard = (min: number): W => {
    q('[data-act="nav"][data-page="projects"]').click();
    const ids = Array.from(w.document.querySelectorAll('[data-act="openp"]')).map((x: W) => x.dataset.id).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
    for (const id of ids) {
      (q(`[data-act="openp"][data-id="${id}"]`) as W).click();
      const sec = Array.from(w.document.querySelectorAll('#panel .sec')).find((s2: W) => s2.querySelector('h3').textContent.indexOf('Статус-звіти') === 0) as W;
      const n = sec ? Number((sec.querySelector('h3').textContent.match(/\((\d+)\)/) || [])[1]) : 0;
      if (n > min) return { sec: () => Array.from(w.document.querySelectorAll('#panel .sec')).find((s2: W) => s2.querySelector('h3').textContent.indexOf('Статус-звіти') === 0) as W, n };
    }
    return null;
  };
  test('#82 карточка: 3 последних статус-отчёта, «Показати всі звіти (N)» — все, «Згорнути» — снова 3', () => {
    const c = openCard(3); expect(c).toBeTruthy();
    expect(c.sec().querySelectorAll('.rep').length).toBe(3);
    const b = c.sec().querySelector('[data-act="togglerp"]'); expect(b.textContent).toBe(`Показати всі звіти (${c.n})`);
    b.click(); expect(c.sec().querySelectorAll('.rep').length).toBe(c.n);
    c.sec().querySelector('[data-act="togglerp"]').click(); expect(c.sec().querySelectorAll('.rep').length).toBe(3);
  });
  test('#85 метка «Звіт»: подсказка «Подано … · автор»', () => {
    q('[data-act="nav"][data-page="projects"]').click();
    const m = q('#main .rep-ap'); expect(m).toBeTruthy(); expect(m.getAttribute('title')).toMatch(/^Подано \d\d\.\d\d\.\d{4} · \S/);
  });
  test('#88 новый риск: срок в прошлом — ошибка, запись не добавлена; сегодня — можно', () => {
    q('[data-act="nav"][data-page="risks"]').click();
    q('[data-act="newrisk"]').click();
    const f = q('#kform'); f.querySelector('#k-title').value = 'Ризик тесту рунд 5'; fillRisk(f); f.querySelector('#k-due').value = '2000-01-01'; ev(f.querySelector('#k-due'), 'change');
    expect(f.querySelector('#k-due-e').hidden).toBe(false);
    f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    expect(err(f)).toMatch(/^Термін не може бути раніше/); expect(q('#kform')).toBeTruthy();
    const d = new Date(); f.querySelector('#k-due').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; ev(f.querySelector('#k-due'), 'change');
    expect(f.querySelector('#k-due-e').hidden).toBe(true);
    f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    expect(w.document.body.textContent).toContain('Ризик тесту рунд 5');
  });
  test('#81 форма отчёта: подсказка о реестре рисков', () => {
    q('[data-act="nav"][data-page="reports"]').click(); q('[data-act="newrep"]:not([data-id])').click();
    expect(q('#f-iss-h').textContent).toMatch(/відкритих: \d+\)/);
  });
});

test('#89 таблицы: своё окно прокрутки на компьютере, заголовки колонок закреплены', () => {
  const css = Array.from(w.document.querySelectorAll('style')).map((x: W) => x.textContent).join('\n');
  expect(css).toMatch(/@media \(min-width:721px\)\{\.tablewrap\.dt\{overflow:auto;max-height:max\(360px,calc\(100vh - 300px\)\)\}\}/);
  expect(css).toMatch(/\.dt thead th\{position:sticky;top:0;z-index:2;background:var\(--bg\);[^}]*\}/);
  expect(css).not.toMatch(/\.dt th\{position:relative\}/);   // относительное положение сбило бы закрепление
});

test('колонки по умолчанию — те же, что в приложении (статус-звіти, ризики)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/webparts/pmoPortal/components/defs.tsx'), 'utf8');
  const app = (re: RegExp): string[] => JSON.parse((src.match(re) as RegExpMatchArray)[1].replace(/'/g, '"'));
  const proto = (k: string): string[] => JSON.parse((HTML.match(new RegExp(`TDEFAULTS\\.${k} = (\\[[^\\]]*\\])`)) as RegExpMatchArray)[1].replace(/'/g, '"'));
  expect(proto('reports')).toEqual(app(/lock: 'proj', cols, defaults: (\['strat', 'prio', 'proj', 'date'[^\]]*\])/));
  expect(proto('risks')).toEqual(app(/lock: 'proj', cols, defaults: (\['strat', 'prio', 'proj', 'title'[^\]]*\])/));
});

// #91 / #92: форма записи реестра — те же векторы, что riskForm.test.ts приложения (tests/cases/risk-form.json)
describe('реєстр ризиків (#91, #92): прототип', () => {
  const RF = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../../tests/cases/risk-form.json'), 'utf8'));
  const ID: Record<string, string> = { title: 'k-title-e', strategy: 'k-str-e', mitigation: 'k-mit-e', contingency: 'k-cont-e' };
  const openNew = (): W => { q('[data-act="nav"][data-page="risks"]').click(); q('[data-act="newrisk"]').click(); return q('#kform'); };
  (RF.errors as any[]).filter(x => x.isNew).forEach(x => test('обязательные поля: ' + x.name, () => {
    const f = openNew();
    const ty = f.querySelector(`input[name="k-type"][value="${x.draft.type}"]`); ty.checked = true; ev(ty, 'change');
    f.querySelector('#k-title').value = x.draft.title; ev(f.querySelector('#k-title'), 'input');
    if (x.draft.strategy) { const s = f.querySelector(`input[name="k-str"][value="${x.draft.strategy}"]`); s.checked = true; ev(s, 'change'); }
    f.querySelector('#k-mit').value = x.draft.mitigation; f.querySelector('#k-cont').value = x.draft.contingency;
    f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    const shown = Object.keys(ID).filter(k => !f.querySelector('#' + ID[k]).hidden);
    expect(shown.sort()).toEqual(x.out.slice().sort());
    // сохранено — запись в списке; нет — сообщение об ошибке в форме
    if (x.out.length) expect(err(f)).not.toBe(''); else expect(q('#main').textContent).toContain(x.draft.title);
  }));
  test('звёздочки — по типу: «Проблема» без стратегії й плану дій', () => {
    const f = openNew();
    expect(q('#k-noap').textContent).toContain('не погоджуються');
    expect(f.querySelector('#k-str-l').textContent).toMatch(/\*$/); expect(f.querySelector('label[for="k-cont"]').textContent).toMatch(/\*$/);
    const ty = f.querySelector('input[name="k-type"][value="Проблема"]'); ty.checked = true; ev(ty, 'change');
    expect(f.querySelector('#k-str-l').textContent).not.toMatch(/\*$/); expect(f.querySelector('label[for="k-mit"]').textContent).toMatch(/\*$/);
  });
  test('сохранённая запись — только статус; «Копіювати ризик» — новая запись со всеми полями, прошедший срок не копируется', () => {
    const f = openNew();
    f.querySelector('#k-title').value = 'Ризик для копії'; fillRisk(f, { strategy: 'Передача', mit: 'Страхування', cont: 'Резерв' });
    f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    const mine = (): W[] => Array.from(w.document.querySelectorAll('#main [data-act="riskopen"]')).filter((b: W) => (b.textContent || '').indexOf('Ризик для копії') >= 0);
    const n0 = mine().length; expect(n0).toBeGreaterThan(0);
    const open = mine()[0] as W;
    expect(open).toBeDefined(); open.click();
    let k = q('#kform');
    const ed = (RF.editable as any[]).filter(x => !x.isNew)[0];
    const sel: Record<string, string> = { title: '#k-title', type: 'input[name="k-type"]', probability: 'input[name="k-pr"]', impact: 'input[name="k-im"]', owner: '#k-owner',
      status: '#k-status', due: '#k-due', strategy: 'input[name="k-str"]', mitigation: '#k-mit', contingency: '#k-cont' };
    expect(ed.fields.map((fl: string) => !k.querySelector(sel[fl]).disabled)).toEqual(ed.out);
    expect(q('#k-only')).toBeTruthy();
    q('#k-copy-btn').click();
    k = q('#kform');
    expect(q('.ph h2').textContent).toBe('Новий ризик'); expect(q('#k-copy').textContent).toContain('Ризик для копії');
    expect(k.querySelector('#k-title').value).toBe('Ризик для копії'); expect(k.querySelector('#k-mit').value).toBe('Страхування');
    expect(k.querySelector('input[name="k-str"][value="Передача"]').checked).toBe(true); expect(k.querySelector('#k-status').value).toBe('Відкрито');
    expect(k.querySelector('#k-title').disabled).toBe(false);
    k.querySelector('#k-mit').value = 'Нові заходи'; ev(k.querySelector('#k-mit'), 'input');
    k.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    expect(mine().length).toBe(n0 * 2);
  });
});
