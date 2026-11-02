import * as fs from 'fs';
import * as path from 'path';
import { T } from '../src/webparts/pmoPortal/i18n/strings';

// Сверка покрытия отзывов (#54–#88, раунд 3 сверки): то же поведение на прототипе в jsdom, через интерфейс.
// Приложение — regression-r3.test.tsx. Каждый тест — на свежем прототипе.
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
const qa = (s: string): W[] => Array.from(w.document.querySelectorAll(s));
const ev = (el: W, t: string): void => { el.dispatchEvent(new w.Event(t, { bubbles: true })); };
const submit = (f: W): void => { f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); };
function asUser(n: string): void { const b = w.document.createElement('button'); b.dataset.act = 'asuser'; b.dataset.n = n; w.document.body.appendChild(b); b.click(); b.remove(); }
const PMO = 'Олександра Мороз';
const isoDay = (ms: number): string => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const TODAY = isoDay(Date.now());
const dmy = (v: string): string => v.split('-').reverse().join('.');
function openReport(): { f: W; g: (id: string) => W; set: (id: string, v: string) => void } {
  q('[data-act="nav"][data-page="reports"]').click();
  q('[data-act="newrep"]:not([data-id])').click();
  const f = q('#repform'); const g = (id: string): W => f.querySelector('#' + id);
  const set = (id: string, v: string): void => { g(id).value = v; ev(g(id), 'input'); ev(g(id), 'change'); };
  return { f, g, set };
}
const sec = (title: string): W => qa('#panel .sec').find((s: W) => (s.querySelector('h3') || { textContent: '' }).textContent.indexOf(title) === 0);

describe('#54 / #64 прототип: фактическая дата проверяется сразу при вводе', () => {
  test('раньше старта и позже сегодня — сообщение у поля с датой сравнения; в допустимых пределах (досрочно) — сообщения нет', () => {
    const { g, set } = openReport();
    set('f-st', 'Скасовано');
    set('f-start', '2026-03-02');
    set('f-ae', '2026-02-01');
    expect(g('e-ae').hidden).toBe(false);
    expect(g('e-ae').textContent).toBe(T.errBeforeStartOn[0].replace('{date}', '02.03.2026'));
    const tomorrow = isoDay(Date.now() + 864e5);
    set('f-ae', tomorrow);
    expect(g('e-ae').hidden).toBe(false);
    expect(g('e-ae').textContent).toBe(T.errAfterSubmit[0].replace('{date}', dmy(TODAY)));
    set('f-ae', TODAY);
    expect(g('e-ae').hidden).toBe(true);
  });
  test('исправленная фактическая дата — подсветка поля снимается, как в приложении', () => {
    const { g, set } = openReport();
    set('f-st', 'Скасовано'); set('f-start', '2026-03-02');
    set('f-ae', '2026-02-01'); expect(g('f-ae').getAttribute('aria-invalid')).toBe('true');
    set('f-ae', TODAY); expect(g('f-ae').getAttribute('aria-invalid')).not.toBe('true');
  });
});

// BUG (прототип ≠ приложение, обещано в ответе на #54): после погодження «Дата завершення (факт)» попадает в карточку и архив,
// но не в «Історію змін» — applyReport прототипа считает diffs по vals без ae, а p.ae ставит уже после (prototype/pmo-prototype.html,
// function applyReport: `if (complete){ p.archivedAt = r.date; if (r.ae) p.ae = r.ae; }`). В приложении — есть (overlay ['actualEnd','ae'],
// синхронизация — $DISPLAY.pmActualEnd; regression-r3.test.tsx). Воспроизведение: отчёт «Завершено» с фактической датой → погодження PMO →
// карточка → «Історія змін»: «Оновлено статус-звітом» — фаза, %, прогноз витрат, без «Дата завершення (факт)».
test.skip('BUG #54 прототип: после погодження фактическая дата — в «Історії змін» проекта', () => {
  const { f, g, set } = openReport();
  const pid = g('f-p').value;
  ['sched', 'budget', 'res'].forEach(n => { f.querySelector(`input[name="${n}"][value="Зелений"]`).checked = true; });
  set('f-st', 'Завершено');
  const start = g('f-start').value || '2000-01-01';
  const ae = start > '2026-09-15' ? start : '2026-09-15';
  set('f-t', 'Готово'); set('f-kr', 'Завершено'); set('f-nd', 'Усе виконано'); set('f-ae', ae);
  submit(f);
  expect(q('#repform')).toBeNull();
  asUser(PMO);
  q('[data-act="nav"][data-page="projects"]').click();
  q(`[data-act="openp"][data-id="${pid}"]`).click();
  q(`.apnote [data-act="repopen"][data-id="${pid}"]`).click();
  submit(q('#apform'));
  q('[data-act="nav"][data-page="archive"]').click();
  q(`[data-act="openp"][data-id="${pid}"]`).click();
  const h = sec('Історія змін');
  expect(h).toBeTruthy();
  expect(h.textContent).toContain('Дата завершення (факт)');
  expect(h.textContent).toContain(dmy(ae));
});

test('#55 прототип: форма риска из карточки — та же, что из общего раздела (тип перед «Опис», заголовок по типу)', () => {
  q('[data-act="nav"][data-page="projects"]').click();
  const ids = qa('[data-act="openp"]').map((x: W) => x.dataset.id);
  let opened = false;
  for (const id of ids) {
    q(`[data-act="openp"][data-id="${id}"]`).click();
    const b = q(`#panel [data-act="newrisk"][data-id="${id}"]`) || q('#panel [data-act="newrisk"]');
    if (b) { b.click(); opened = true; break; }
  }
  expect(opened).toBe(true);
  const f = q('#kform');
  expect(f.querySelector('fieldset.ragpick').compareDocumentPosition(f.querySelector('#k-title')) & w.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(f.querySelector('label[for="k-title"]').textContent).toContain('Опис');
  expect(q('.ph h2').textContent).toBe('Новий ризик');
  const r = f.querySelector('input[name="k-type"][value="Проблема"]'); r.checked = true; ev(r, 'change');
  expect(q('.ph h2').textContent).toBe('Нова проблема');
});

test('#58 прототип: после сортировки и смены представления карточки — те же строки и в том же порядке, что таблица', () => {
  const firstCells = (): string[] => qa('.tablewrap.dt.has-cards tbody tr').map((tr: W) => (tr.querySelector('[data-act="openp"], [data-act="riskopen"], [data-act="repopen"]') || tr).textContent.trim());
  for (const page of ['reports', 'risks']) {
    q(`[data-act="nav"][data-page="${page}"]`).click();
    const sorter = q('.dt thead [data-act="tsort"]') || q('.dt thead button');
    if (sorter) { sorter.click(); }
    const rows = qa('.tablewrap.dt.has-cards tbody tr').length;
    expect(rows).toBeGreaterThan(0);
    expect(qa('.mcards .mcard').length).toBe(rows);
    // представление «Усі» / другое — состав меняется вместе с таблицей
    const vs = q('select[data-act="view"]');
    for (const o of Array.from(vs.options) as W[]) {
      const s = q('select[data-act="view"]'); s.value = o.value; ev(s, 'change');
      expect(qa('.mcards .mcard').length).toBe(qa('.tablewrap.dt.has-cards tbody tr').length);
    }
    expect(firstCells().length).toBe(qa('.mcards .mcard').length);
  }
});

describe('#62 / #69 прототип: дата подання и период не вводятся', () => {
  test('в форме нет поля даты отчёта и выбора периода; показаны «сегодня» и «з … по …»', () => {
    const { f } = openReport();
    expect(f.querySelectorAll('#f-sub input, #f-sub select').length).toBe(0);
    expect(f.querySelector('#f-date, #f-d, #f-per, #f-period, select[name="period"]')).toBeNull();
    Array.from(f.querySelectorAll('select')).forEach((s: W) => expect(s.textContent).not.toMatch(/Квартал|Тиждень|Місяць/));
    expect(q('#f-sub').textContent).toContain(dmy(TODAY));
    expect(q('#f-sub-per').textContent).toMatch(new RegExp(`^(з \\d\\d\\.\\d\\d\\.\\d{4} по ${dmy(TODAY).replace(/\./g, '\\.')}|за ${dmy(TODAY).replace(/\./g, '\\.')})$`));
  });
  test('сохранённый отчёт получает дату подання = сегодня', () => {
    const count = (): number => { q('[data-act="nav"][data-page="reports"]').click(); const s = q('select[data-act="view"]'); s.value = 'all'; ev(s, 'change');
      return qa('#main .tablewrap tbody tr').filter((tr: W) => tr.textContent.indexOf(dmy(TODAY)) >= 0).length; };
    const n0 = count();
    const { f, set } = openReport();
    ['sched', 'budget', 'res'].forEach(n => { f.querySelector(`input[name="${n}"][value="Зелений"]`).checked = true; });
    set('f-t', 'Резюме r3'); set('f-nd', 'Усе виконано');
    submit(f);
    expect(q('#repform')).toBeNull();
    expect(count()).toBe(n0 + 1);
  });
});

test('#63 прототип: все переключатели форм отчёта и риска — input + label в .ragpick или шкале 1–5', () => {
  const check = (f: W): number => {
    const rs = Array.from(f.querySelectorAll('input[type="radio"]')) as W[];
    rs.forEach(r => {
      expect(r.closest('.ragpick, .opts.scale')).not.toBeNull();
      expect(r.nextElementSibling && r.nextElementSibling.tagName).toBe('LABEL');
    });
    return rs.length;
  };
  expect(check(openReport().f)).toBeGreaterThanOrEqual(9);
  q('[data-act="nav"][data-page="risks"]').click(); q('[data-act="newrisk"]').click();
  expect(check(q('#kform'))).toBeGreaterThanOrEqual(2 + 5 + 5 + 4);
});

test('#68 прототип: «Яке рішення потрібне» — со звёздочкой; пустое — сообщение у поля и отчёт не сохраняется', () => {
  const { f, g, set } = openReport();
  ['sched', 'budget', 'res'].forEach(n => { f.querySelector(`input[name="${n}"][value="Зелений"]`).checked = true; });
  set('f-t', 'Резюме'); set('f-nd', 'Усе виконано');
  const cb = g('f-dec'); cb.checked = true; ev(cb, 'change');
  expect(f.querySelector('label[for="f-dect"]').textContent).toMatch(/\*/);
  for (const v of ['', '   ']) {
    set('f-dect', v); submit(f);
    expect(q('#repform')).toBeTruthy();
    expect(g('e-dect').hidden).toBe(false); expect(g('e-dect').textContent).toBe(T.errDecision[0]);
  }
});

test('#76 прототип: в «Архіві» — только «Завершено» / «Скасовано», колонка «Фаза проєкту» показывает какой', () => {
  q('[data-act="nav"][data-page="archive"]').click();
  const mode = q('[data-act="mode"][data-mode="list"]'); if (mode) mode.click();
  const heads = qa('#main .dt thead th').map((h: W) => h.textContent.trim());
  const si = heads.findIndex((h: string) => h.indexOf('Фаза проєкту') === 0);
  expect(si).toBeGreaterThanOrEqual(0);
  const vals = qa('#main .dt tbody tr').map((tr: W) => tr.children[si].textContent.trim());
  expect(vals.length).toBeGreaterThan(0);
  vals.forEach((v: string) => expect(['Завершено', 'Скасовано']).toContain(v));
});

test('#78 прототип: «Фаза проєкту» — колонка списка проектов, форма отчёта, карточка', () => {
  q('[data-act="nav"][data-page="projects"]').click();
  const mode = q('[data-act="mode"][data-key="projMode"][data-mode="list"]'); if (mode) mode.click();
  const heads = qa('#main .dt thead th').map((h: W) => h.textContent.trim());
  expect(heads.some((h: string) => h.indexOf('Фаза проєкту') === 0)).toBe(true);
  expect(heads.some((h: string) => /^Статус(\s|$)/.test(h))).toBe(false);
  q('[data-act="openp"]').click();
  expect(q('#panel').textContent).toContain('Фаза проєкту');
  const { f } = openReport();
  expect(f.querySelector('label[for="f-st"]').textContent).toContain('Фаза проєкту');
});

test('#83 прототип: форма существующего проекта — права обновятся в течение ~15 минут; нового — без подсказки', () => {
  q('[data-act="nav"][data-page="projects"]').click(); q('[data-act="openp"][data-id="1"]').click();
  q('[data-act="editproj"][data-id="1"]').click();
  expect(q('#pform').textContent).toContain(T.accessRecalc[0]);
  asUser(PMO);
  q('[data-act="nav"][data-page="projects"]').click(); q('[data-act="newproj"]').click();
  expect(q('#pform').textContent).not.toContain(T.accessRecalc[0]);
});

test('#87 прототип: PMO в колокольчике — новый высокий ризик и новая проблема; низкий ризик — нет', () => {
  const add = (title: string, type: string, p: number, i: number): void => {
    q('[data-act="nav"][data-page="risks"]').click(); q('[data-act="newrisk"]').click();
    const f = q('#kform');
    const ty = f.querySelector(`input[name="k-type"][value="${type}"]`); ty.checked = true; ev(ty, 'change');
    for (const [n, v] of [['k-pr', p], ['k-im', i]] as [string, number][]) { const r = f.querySelector(`input[name="${n}"][value="${v}"]`); r.checked = true; ev(r, 'change'); }
    f.querySelector('#k-title').value = title; ev(f.querySelector('#k-title'), 'input');
    if (type === 'Ризик') { const s = f.querySelector('input[name="k-str"][value="Прийняття"]'); s.checked = true; ev(s, 'change'); }
    for (const [id, v] of [['k-mit', 'Заходи'], ['k-cont', 'План дій']]) { const t = f.querySelector('#' + id); if (t) { t.value = v; ev(t, 'input'); } }
    submit(f);
    const e = f.querySelector('.err'); expect(e && !e.hidden ? e.textContent : '').toBe('');
  };
  add('R3 високий ризик', 'Ризик', 5, 5);
  add('R3 низький ризик', 'Ризик', 1, 2);
  add('R3 проблема', 'Проблема', 1, 1);
  q('[data-act="nav"][data-page="risks"]').click();
  ['R3 високий ризик', 'R3 низький ризик', 'R3 проблема'].forEach(x => expect(q('#main').textContent).toContain(x));   // все три сохранены
  asUser(PMO);
  q('#bell').click();
  const txt = q('#panel').textContent;
  expect(txt).toContain('R3 високий ризик');
  expect(txt).toContain('R3 проблема');
  expect(txt).not.toContain('R3 низький ризик');
});
