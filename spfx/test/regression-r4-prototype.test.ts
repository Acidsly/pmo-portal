import * as fs from 'fs';
import * as path from 'path';
import { T } from '../src/webparts/pmoPortal/i18n/strings';
import { parseMoney } from '../src/webparts/pmoPortal/logic/money';
import { parseDmy } from '../src/webparts/pmoPortal/logic/dates';

// Регрессия по отзывам (аудит r4) — прототип prototype/pmo-prototype.html в jsdom, через его интерфейс:
// #105, #114, #116, #117, #119, #130, #131. Каждый тест — на свежем прототипе.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JSDOM } = require('jsdom');
const SRC_HTML = fs.readFileSync(path.join(__dirname, '../../prototype/pmo-prototype.html'), 'utf8');
// доступ к внутренним функциям прототипа (они в замыкании) — только для сверки с приложением
const HOOK = 'initData();\n})();';
const HTML = SRC_HTML.replace(HOOK, 'initData();\nwindow.__r4 = {get PROJ(){ return PROJ; }, dynamics, donut, isArch, moneyVal, dmyParse, iso, TODAY, fmt, tv, t};\n})();');
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
test('крючок к прототипу на месте', () => { expect(SRC_HTML.split(HOOK).length).toBe(2); expect(typeof w.__r4.dynamics).toBe('function'); });
const q = (s: string): W => w.document.querySelector(s);
const qa = (s: string): W[] => Array.from(w.document.querySelectorAll(s));
const ev = (el: W, t: string): void => { el.dispatchEvent(new w.Event(t, { bubbles: true })); };
const submit = (f: W): void => { f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); };
const err = (f: W): string => { const e = f.querySelector('p.err'); return e && !e.hidden ? e.textContent : ''; };
function asPmo(): void { const b = w.document.createElement('button'); b.dataset.act = 'asuser'; b.dataset.n = 'Олександра Мороз'; w.document.body.appendChild(b); b.click(); b.remove(); }
function openReport(): W { q('[data-act="nav"][data-page="reports"]').click(); q('[data-act="newrep"]:not([data-id])').click(); return q('#repform'); }
function openNewRisk(): W { q('[data-act="nav"][data-page="risks"]').click(); q('[data-act="newrisk"]').click(); return q('#kform'); }
function openNewProject(): W { asPmo(); q('[data-act="nav"][data-page="projects"]').click(); q('[data-act="newproj"]').click(); return q('#pform'); }
/** Ввод в текстовое поле даты прототипа (id исходного поля + «-t»), как с клавиатуры. */
function typeDate(f: W, id: string, digits: string): W { const t = f.querySelector('#' + id + '-t'); t.focus(); t.value = digits; ev(t, 'input'); return t; }
const badShown = (t: W): boolean => { const b = t.parentNode.nextElementSibling; return !!b && b.classList.contains('date-bad') && !b.hidden; };

// ---------- #131 ----------
describe('#131 суми з копійками: прототип', () => {
  test('moneyVal прототипа = parseMoney приложения на классе входов', () => {
    const moneyVal = w.__r4.moneyVal;
    const inputs = ['1450,50', '1450.50', '1 450,50', '1 450,49', '600,5', '0,5', '0,49', '1450,', ',5', '2,400,000', '1.450.000', '1,450.50', '145050', '', '  ', 'abc', '12 345', '9,99', '1450,505'];
    expect(inputs.map(s => [s, moneyVal(s)])).toEqual(inputs.map(s => [s, parseMoney(s)]));
  });
  const CASES: [string, string, string][] = [['1450,50', '1450,50', '1 451'], ['500.50', '500.50', '501'], ['600,5', '600,5', '601'], ['1 450,49', '1450,49', '1 450'],
    ['2,400,000', '2,400,000', '2 400 000'], ['0,5', '0,5', '1']];
  const typeMoney = (el: W, typed: string): void => { el.focus(); ev(el, 'focus'); el.value = ''; for (const ch of typed) { el.value += ch; ev(el, 'input'); } };
  test.each(CASES)('новий проєкт «Бюджет»: «%s» по символу', (typed, focused, shown) => {
    const f = openNewProject(); const b = f.querySelector('#p-budget');
    typeMoney(b, typed); expect(b.value).toBe(focused);
    b.blur(); ev(b, 'blur'); expect(b.value).toBe(shown);
  });
  test.each(CASES)('звіт (усі три суми): «%s» по символу', (typed, focused, shown) => {
    const f = openReport();
    for (const id of ['f-c', 'f-bp', 'f-fcost']) {
      const el = f.querySelector('#' + id);
      typeMoney(el, typed); expect([id, el.value]).toEqual([id, focused]);
      el.blur(); ev(el, 'blur'); expect([id, el.value]).toEqual([id, shown]);
    }
  });
});

// ---------- #119 ----------
describe('#119 некоректна дата: прототип', () => {
  const dmyParse = (): W => w.__r4.dmyParse;
  test('dmyParse прототипа = parseDmy приложения', () => {
    const xs = ['31.11.2026', '30.11.2026', '29.02.2027', '29.02.2028', '00.01.2026', '15.13.2026', '01.01.1899', '01.01.1900', '30.11', '3', '', '31.12.2026'];
    expect(xs.map(x => [x, dmyParse()(x)])).toEqual(xs.map(x => [x, parseDmy(x)]));
  });
  test.each(['31112026', '29022027', '00012026', '15132026'])('звіт: «%s» — після виходу з поля помилка, текст лишається, звіт не зберігається', d => {
    const f = openReport();
    const t = typeDate(f, 'f-plan', d); t.blur(); ev(t, 'blur');
    expect(t.value).toBe(`${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`);
    expect(badShown(t)).toBe(true); expect(f.querySelector('#f-plan').value).toBe('');
    submit(f); expect(q('#repform')).toBeTruthy(); expect(err(f)).toBe(T.errDateBad[0]);
  });
  test('ризик: повна некоректна дата — помилка одразу, як у застосунку (DateIn)', () => {
    const f = openNewRisk(); const t = typeDate(f, 'k-due', '31112099');
    expect(badShown(t)).toBe(true); expect(t.getAttribute('aria-invalid')).toBe('true');
  });
  // Знайдено звіркою 02.11.2026, виправлено (clearAll не чіпає .date-bad): у формі звіту прототипу обробник форми «input» (clearAll, #40) ховає всі .ferr і знімає aria-invalid — зокрема помилку дати,
  // яку щойно показало саме поле. Застосунок (DateIn) показує помилку одразу й не ховає її при правці інших полів; прототип — ні.
  test(': звіт — повна некоректна дата: помилка одразу (без виходу з поля), як у застосунку', () => {
    const f = openReport(); const t = typeDate(f, 'f-plan', '31112026');
    expect(badShown(t)).toBe(true); expect(t.getAttribute('aria-invalid')).toBe('true');
  });
  test(': звіт — правка іншого поля не ховає помилку некоректної дати, поки дату не виправлено', () => {
    const f = openReport(); const t = typeDate(f, 'f-plan', '31112026'); t.blur(); ev(t, 'blur'); expect(badShown(t)).toBe(true);
    const s = f.querySelector('#f-title') || f.querySelector('textarea'); s.value = 'Резюме'; ev(s, 'input');
    expect(t.dataset.bad).toBe('1');            // дата досі некоректна (збереження блокується)…
    expect(badShown(t)).toBe(true);             // …а пояснення під полем зникло
  });
  test('неповна дата при виході — помилка; стерли — помилки немає', () => {
    const f = openReport(); const t = typeDate(f, 'f-golive', '3011'); t.blur(); ev(t, 'blur');
    expect(t.value).toBe('30.11'); expect(badShown(t)).toBe(true);
    t.value = ''; ev(t, 'input'); t.blur(); ev(t, 'blur');
    expect(badShown(t)).toBe(false);
  });
  test('вибір у календарі (нативне поле, change) знімає помилку', () => {
    const f = openReport(); const t = typeDate(f, 'f-plan', '31112026'); t.blur(); ev(t, 'blur'); expect(badShown(t)).toBe(true);
    // системный выбор даты меняет значение без JS-сеттера поля — как браузер
    const n = f.querySelector('#f-plan'); (Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value') as W).set.call(n, '2026-11-30'); ev(n, 'change');
    expect(badShown(t)).toBe(false); expect(t.value).toBe('30.11.2026');
  });
  test('інший проєкт у формі звіту — некоректний текст попереднього не лишається й не блокує', () => {
    const f = openReport(); const sel = f.querySelector('#f-p');
    expect(sel && sel.tagName).toBe('SELECT'); expect(sel.options.length).toBeGreaterThan(1);   // сценарий есть всегда: у формы несколько проектов
    const t = typeDate(f, 'f-golive', '31112026'); t.blur(); ev(t, 'blur'); expect(badShown(t)).toBe(true);
    const other = Array.from(sel.options).map((o: W) => o.value).filter((v: string) => v !== sel.value)[0];
    sel.value = other; ev(sel, 'change');
    const f2 = q('#repform'); const t2 = f2.querySelector('#f-golive-t');
    expect(t2.dataset.bad).toBeUndefined(); expect(badShown(t2)).toBe(false);
  });
  test('новий ризик: «31.11.2099» у терміні — не зберігається, помилка про дату', () => {
    const f = openNewRisk();
    f.querySelector('#k-title').value = 'Ризик з датою'; ev(f.querySelector('#k-title'), 'input');
    const s = f.querySelector('input[name="k-str"][value="Прийняття"]'); s.checked = true; ev(s, 'change');
    for (const [id, v] of [['k-mit', 'Заходи'], ['k-cont', 'План']]) { const x = f.querySelector('#' + id); x.value = v; ev(x, 'input'); }
    const t = typeDate(f, 'k-due', '31112099'); t.blur(); ev(t, 'blur');
    submit(f);
    expect(err(f)).toBe(T.errDateBad[0]);
    expect(q('#main').textContent).not.toContain('Ризик з датою');
  });
  test('новий проєкт: «31.11.2026» у «Дата старту» — проєкт не створюється', () => {
    const f = openNewProject();
    f.querySelector('#p-title').value = 'Проєкт з поганою датою'; ev(f.querySelector('#p-title'), 'input');
    const pm = f.querySelector('#p-pm'); if (pm.tagName === 'SELECT') { pm.value = Array.from(pm.options).map((o: W) => o.value).filter(Boolean)[1]; ev(pm, 'change'); }
    const c = f.querySelector('#p-country'); if (c) { c.value = 'Польща'; ev(c, 'change'); }
    const t = typeDate(f, 'p-start', '31112026'); t.blur(); ev(t, 'blur');
    submit(f);
    expect(err(f)).toBe(T.errDateBad[0]); expect(q('#pform')).toBeTruthy();
    q('[data-act="nav"][data-page="projects"]').click();
    expect(q('#main').textContent).not.toContain('Проєкт з поганою датою');
  });
});

// ---------- #130 ----------
describe('#130 опис ризику / проблеми: прототип, копія запису', () => {
  test('копія: → Проблема (опис переноситься) → змінили → Ризик — вихідний опис; → Проблема — опис проблеми', () => {
    const f = openNewRisk();
    f.querySelector('#k-title').value = 'Вихідний ризик'; ev(f.querySelector('#k-title'), 'input');
    const s = f.querySelector('input[name="k-str"][value="Передача"]'); s.checked = true; ev(s, 'change');
    for (const [id, v] of [['k-mit', 'Заходи'], ['k-cont', 'План']]) { const x = f.querySelector('#' + id); x.value = v; ev(x, 'input'); }
    submit(f);
    const open = qa('#main [data-act="riskopen"]').filter(b => (b.textContent || '').indexOf('Вихідний ризик') >= 0)[0];
    expect(open).toBeDefined(); open.click(); q('#k-copy-btn').click();
    const k = q('#kform'); const t = k.querySelector('#k-title');
    const ty = (v: string): void => { const r = k.querySelector(`input[name="k-type"][value="${v}"]`); r.checked = true; ev(r, 'change'); };
    expect(t.value).toBe('Вихідний ризик');
    ty('Проблема'); expect(t.value).toBe('Вихідний ризик');
    t.value = 'Опис проблеми'; ev(t, 'input');
    ty('Ризик'); expect(t.value).toBe('Вихідний ризик');
    ty('Проблема'); expect(t.value).toBe('Опис проблеми');
    expect(q('.ph h2').textContent).toBe(T.newIssueT[0]);
  });
  test('збереження після перемикань — запис з типом і описом поточного типу', () => {
    const f = openNewRisk(); const t = f.querySelector('#k-title');
    const ty = (v: string): void => { const r = f.querySelector(`input[name="k-type"][value="${v}"]`); r.checked = true; ev(r, 'change'); };
    t.value = 'Опис-ризику-130'; ev(t, 'input'); ty('Проблема'); t.value = 'Опис-проблеми-130'; ev(t, 'input');
    const m = f.querySelector('#k-mit'); m.value = 'Заходи'; ev(m, 'input');
    submit(f); expect(err(f)).toBe('');
    const txt = q('#main').textContent;
    expect(txt).toContain('Опис-проблеми-130'); expect(txt).not.toContain('Опис-ризику-130');
  });
});

// ---------- #114 ----------
test('#114 прототип: кожна картка ризику — червоний термін тоді й лише тоді, коли відкритий і прострочений', () => {
  q('[data-act="nav"][data-page="risks"]').click();
  const today = w.__r4.iso(w.__r4.TODAY) as string;
  const cards = qa('#main .mcards .mcard');
  expect(cards.length).toBeGreaterThan(0);
  let late = 0, checked = 0;
  for (const c of cards) {
    const m = (c.querySelector('.mc-m').textContent || '').match(/(\d\d)\.(\d\d)\.(\d{4})\s*$/); if (!m) continue;
    const due = `${m[3]}-${m[2]}-${m[1]}`; const closed = (c.querySelector('.mc-m').textContent || '').indexOf('Закрито') >= 0;
    const expectLate = due < today && !closed; checked++;
    expect([due, closed, !!c.querySelector('.mc-m .late')]).toEqual([due, closed, expectLate]);
    if (expectLate) late++;
  }
  expect(checked).toBeGreaterThan(0); expect(late).toBeGreaterThan(0);
});

// ---------- #116 ----------
test('#116 прототип: нативне поле календаря — у тій самій обгортці після кнопки (лягає поверх неї на сенсорному екрані)', () => {
  const f = openReport();
  const wraps = Array.from(f.querySelectorAll('.date-in')) as W[];
  expect(wraps.length).toBeGreaterThan(0);
  for (const wr of wraps) {
    const kids = Array.from(wr.children).map((x: W) => x.className || x.type);
    expect(kids.indexOf('date-native')).toBeGreaterThan(kids.indexOf('date-btn'));
    expect(wr.querySelector('.date-native').tabIndex).toBe(-1);
  }
});

// ---------- #117 ----------
test('#117 прототип: «сьогодні» у «Динаміці» = кільце, коли картка не збігається з останнім погодженим звітом', () => {
  asPmo();
  const PROJ = w.__r4.PROJ as W[];
  // карточка не обновлена погодженим отчётом (как PRJ-018: отчёт «не застосовано») — у нескольких проектов разные расхождения
  const act = PROJ.filter((p: W) => !w.__r4.isArch(p));
  const rags = ['', 'Червоний', 'Жовтий', ''];
  act.slice(0, 4).forEach((p: W, i: number) => { p.rag = rags[i]; });
  const counts = (svg: string, label: (k: string) => string): Record<string, number> => {
    const d = w.document.createElement('div'); d.innerHTML = svg; const out: Record<string, number> = {};
    for (const k of ['Зелений', 'Жовтий', 'Червоний', '']) {
      const tt = Array.from(d.querySelectorAll('title')).map((x: W) => x.textContent as string).filter(x => x.indexOf(label(k)) >= 0);
      out[k || 'none'] = tt.length ? +(tt[tt.length - 1].split('— ').pop() as string) : 0;
    }
    return out;
  };
  const today = w.__r4.fmt(w.__r4.TODAY);
  const tv = w.__r4.tv, t = w.__r4.t;
  const dyn = counts(w.__r4.dynamics(), k => `${today}: ${k ? tv(k) : t('notRated')} — `);
  const dn = w.document.createElement('div'); dn.innerHTML = w.__r4.donut();
  const ring: Record<string, number> = { 'Зелений': 0, 'Жовтий': 0, 'Червоний': 0, none: 0 };
  Array.from(dn.querySelectorAll('.legend li')).forEach((li: W) => { const n = +li.querySelector('b').textContent; const lbl = li.textContent.slice(String(n).length);
    ring[lbl === t('notRated') ? 'none' : lbl] = n; });
  expect(dyn).toEqual(ring);
  expect(ring.none).toBeGreaterThan(0);
});

// ---------- #105 ----------
describe('#105 тип і пріоритет: прототип', () => {
  const order = (f: W): string[] => Array.from(f.querySelectorAll('h3.fsec, #p-prio')).map((e: W) => (e.tagName === 'H3' ? e.textContent : '#prio')).slice(0, 3);
  test('новий проєкт: «Пріоритет» у «Основне» (до «Люди»), з підказкою', () => {
    const nf = openNewProject();
    expect(order(nf)).toEqual([T.fGeneral[0], '#prio', T.fPeople[0]]);
    expect(nf.querySelector('#p-prio').closest('.frow').querySelector('.hint').textContent).toBe(T.prioHint[0]);
  });
  test('редагування: «Пріоритет» у «Основне» (до «Люди»), з підказкою', () => {
    q('[data-act="nav"][data-page="projects"]').click(); q('[data-act="openp"][data-id="1"]').click(); q('[data-act="editproj"][data-id="1"]').click();
    const f = q('#pform');
    expect(order(f)).toEqual([T.fGeneral[0], '#prio', T.fPeople[0]]);
    expect(f.querySelector('#p-prio').closest('.frow').querySelector('.hint').textContent).toBe(T.prioHint[0]);
  });
  test('стратегічний проєкт з низьким пріоритетом зберігається без помилки й без причини', () => {
    const PROJ = w.__r4.PROJ as W[];
    q('[data-act="nav"][data-page="projects"]').click();
    // стратегический активный проект, который текущий пользователь может править
    const p = PROJ.filter((x: W) => x.type === 'Стратегічний' && !w.__r4.isArch(x)).find((x: W) => {
      const o = q(`[data-act="openp"][data-id="${x.id}"]`); if (!o) return false; o.click(); return !!q(`[data-act="editproj"][data-id="${x.id}"]`); });
    expect(p).toBeDefined();
    q(`[data-act="editproj"][data-id="${p.id}"]`).click();
    const f = q('#pform');
    const s = f.querySelector('#p-prio'); s.value = '3 — Низький'; ev(s, 'change');
    const d = f.querySelector('#p-desc'); if (!d.value.trim()) { d.value = 'Мета'; ev(d, 'input'); }
    submit(f);
    expect(err(f)).toBe('');
    expect(p.prio).toBe('3 — Низький');
  });
});
