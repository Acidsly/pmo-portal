import * as fs from 'fs';
import * as path from 'path';
import { T } from '../src/webparts/pmoPortal/i18n/strings';

// Доработки по отзывам R8 (#118, #120, #124, #125, #127, #128, #132–#136) — прототип в jsdom: общие векторы на его функциях (window.PPM_RULES)
// и сценарии через интерфейс. Каждый тест — на свежем прототипе.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JSDOM } = require('jsdom');
const HTML = fs.readFileSync(path.join(__dirname, '../../prototype/pmo-prototype.html'), 'utf8');
const V = (f: string): any => JSON.parse(fs.readFileSync(path.join(__dirname, '../../tests/cases', f), 'utf8'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = any;
let w: W;
let answer = true;   // ответ на window.confirm
let asked: string[] = [];
beforeEach(async () => {
  answer = true; asked = [];
  w = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://pmo.test/', beforeParse(win: W) {
    win.matchMedia = () => ({ matches: false, addEventListener() { /* */ }, removeEventListener() { /* */ }, addListener() { /* */ } });
    win.HTMLElement.prototype.scrollIntoView = function (): void { /* */ }; win.scrollTo = () => undefined;
    win.confirm = (m: string) => { asked.push(m); return answer; }; } }).window;
  for (let i = 0; i < 20 && !w.document.querySelector('[data-act="lang"]'); i++) await new Promise(r => setTimeout(r, 0));
  w.document.querySelector('[data-act="lang"][data-i="0"]').click();
});
afterEach(() => { if (w) w.close(); });
const q = (s: string): W => w.document.querySelector(s);
const qa = (s: string): W[] => Array.from(w.document.querySelectorAll(s));
const ev = (el: W, t: string): void => { el.dispatchEvent(new w.Event(t, { bubbles: true })); };
const set = (el: W, v: string): void => { el.value = v; ev(el, 'input'); ev(el, 'change'); };
function openReport(): W { q('[data-act="nav"][data-page="reports"]').click(); q('[data-act="newrep"]:not([data-id])').click(); return q('#repform'); }
const shown = (el: W): string => (el && !el.hidden ? el.textContent : '');

describe('общие векторы на функциях прототипа', () => {
  for (const c of V('report-warn.json').cases as any[]) test('предупреждения формы: ' + c.name, () => {
    expect(JSON.parse(JSON.stringify(w.PPM_RULES.reportWarnings(c.d, c.p, c.open, c.today)))).toEqual(c.out);
  });
  for (const c of V('report-money.json').cases as any[]) test('суммы на дату отчёта: ' + c.name, () => {
    // отчёт прототипа: bplan / cost / fcost; карточка: budget / actual / fcost
    const reps = c.reports.map((r: any) => ({ id: r.id, date: r.date, approval: r.approval, bplan: r.budgetPlan, cost: r.actualCost, fcost: r.forecastCost }));
    const p = { budget: c.p.budget, actual: c.p.actualCost, fcost: c.p.forecastCost };
    expect(JSON.parse(JSON.stringify(w.PPM_RULES.reportMoneyAt(reps, p, reps.filter((r: any) => r.id === c.r)[0])))).toEqual(c.out);
  });
  for (const c of V('decision.json').cases as any[]) test('«Потребують рішення»: ' + c.name, () => {
    const reps = c.reports.map((r: any) => ({ ...r, pid: r.projectId }));
    const latest = w.PPM_RULES.latestReportIds(reps);
    expect(reps.filter((r: any) => r.decision && latest.has(r.id)).map((r: any) => r.id).sort()).toEqual(c.out);
  });
});

test('#128 прототип: представление «Високі ризики та проблеми»', () => {
  q('[data-act="nav"][data-page="risks"]').click();
  const opts = (Array.from(q('select[data-act="view"]').options) as W[]).map(o => o.textContent);
  expect(opts).toContain('Високі ризики та проблеми');
  expect(opts).not.toContain('Високі ризики');
});

test('#118 прототип: ризик архівного проєкту — «Проєкт в архіві — ризик лише для перегляду»', () => {
  q('[data-act="nav"][data-page="risks"]').click();
  const s = q('select[data-act="view"]'); s.value = 'archived'; ev(s, 'change');
  const open = q('#main [data-act="riskopen"]'); expect(open).not.toBeNull(); open.click();
  expect(q('#k-ro').textContent).toBe('🔒 ' + T.riskArchived[0]);
});

describe('форма звіту прототипа', () => {
  test('#127: прогноз минув — попередження; виправили — зникло', () => {
    const f = openReport(); const fc = f.querySelector('#f-fc'), wr = f.querySelector('#w-fc');
    set(fc, '2020-01-10'); expect(shown(wr)).toBe(T.warnForecastPast[0]);
    set(fc, '2099-01-10'); expect(shown(wr)).toBe('');
  });
  test('#125: витрати менші за погоджені — попередження; підказка «з початку проєкту»', () => {
    const f = openReport(); const c = f.querySelector('#f-c');
    expect(f.textContent).toContain(T.costHint[0]);
    const before = c.value.replace(/\s/g, '');
    expect(Number(before)).toBeGreaterThan(0);   // у первого проекта формы есть погоджені витрати
    set(c, '1'); expect(shown(f.querySelector('#w-c'))).toMatch(/^Менше за погоджені витрати \(.+\$\) — перевірте суму\.$/);
    set(c, before); expect(shown(f.querySelector('#w-c'))).toBe('');
  });
  test('#124 / #134: відкриті ризики — списком у формі; «Завершено» — попередження з кількістю, список розкрито', () => {
    const f = openReport(); const sel = f.querySelector('#f-p');
    // проект формы с открытыми рисками
    const ids = (Array.from(sel.options) as W[]).filter(o => !o.disabled).map(o => o.value);
    let det: W = null;
    for (const id of ids) { set(sel, id); det = f.querySelector('#f-risks'); if (det) break; }
    expect(det).not.toBeNull();
    const n = det.querySelectorAll('li').length; expect(n).toBeGreaterThan(0);
    expect(det.querySelector('summary').textContent).toBe(T.openRisksT[0].replace('{n}', String(n)));
    expect(det.open).toBe(false);
    set(f.querySelector('#f-st'), 'Завершено');
    expect(shown(f.querySelector('#w-st'))).toBe(T.warnArchRisks[0].replace('{n}', String(n)));
    expect(f.querySelector('#f-risks').open).toBe(true);
  });
  test('#133: зміна проєкту з текстом — питання; «ні» — проєкт і текст лишаються; «так» — текст очищено', () => {
    const f = openReport(); const sel = f.querySelector('#f-p');
    const ids = (Array.from(sel.options) as W[]).filter(o => !o.disabled).map(o => o.value);
    expect(ids.length).toBeGreaterThan(1);
    const first = sel.value, other = ids.filter(x => x !== first)[0];
    set(sel, other); expect(asked).toEqual([]);                          // без текста — без вопроса
    set(f.querySelector('#f-t'), 'Резюме'); set(f.querySelector('#f-done'), 'Зроблено');
    answer = false; set(sel, first);
    expect(asked).toEqual([T.confirmSwitch[0]]);
    expect([sel.value, f.querySelector('#f-t').value]).toEqual([other, 'Резюме']);
    answer = true; set(sel, first);
    expect([sel.value, f.querySelector('#f-t').value, f.querySelector('#f-done').value]).toEqual([first, '', '']);
  });
  test('#134: закрити змінену форму (кнопка, Esc) — питання; «ні» — форма лишається; незмінену — без питання', () => {
    const open = (): boolean => q('#panel').classList.contains('open');
    let f = openReport();
    q('#repform [data-act="close"]').click(); expect(asked).toEqual([]); expect(open()).toBe(false);
    f = openReport(); set(f.querySelector('#f-t'), 'Чернетка');
    answer = false; q('#repform [data-act="close"]').click();
    expect(asked).toEqual([T.confirmClose[0]]); expect(open()).toBe(true);
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(asked.length).toBe(2); expect(open()).toBe(true);
    answer = true; q('#repform [data-act="close"]').click(); expect(open()).toBe(false);
  });
  test('#120: «План виконано повністю» — поле закрите, «Усе виконано», без зірочки; звіт зберігається з цим значенням', () => {
    const f = openReport(); const sel = f.querySelector('#f-p');
    const ids = (Array.from(sel.options) as W[]).filter(o => !o.disabled).map(o => o.value);
    for (const id of ids) { set(sel, id); if (!f.querySelector('#f-pdone-wrap').hidden) break; }
    expect(f.querySelector('#f-pdone-wrap').hidden).toBe(false);          // у проекта есть план прошлого отчёта
    const nd = f.querySelector('#f-nd');
    expect(f.querySelector('#f-nd-req').textContent).toBe(' *');
    const cb = f.querySelector('#f-pdone'); cb.checked = true; ev(cb, 'change');
    expect([nd.disabled, nd.value, f.querySelector('#f-nd-req').textContent]).toEqual([true, 'Усе виконано', '']);
    cb.checked = false; ev(cb, 'change');
    expect([nd.disabled, nd.value, f.querySelector('#f-nd-req').textContent]).toEqual([false, '', ' *']);
  });
  test('#120 (кросс-ревью): зміна проєкту знімає «План виконано повністю»', () => {
    const f = openReport(); const sel = f.querySelector('#f-p');
    const ids = (Array.from(sel.options) as W[]).filter(o => !o.disabled).map(o => o.value);
    const withPlan = ids.filter(id => { set(sel, id); return !f.querySelector('#f-pdone-wrap').hidden; });
    expect(withPlan.length).toBeGreaterThan(1);
    set(sel, withPlan[0]); const cb = f.querySelector('#f-pdone'); cb.checked = true; ev(cb, 'change');
    set(sel, withPlan[1]);
    expect([cb.checked, f.querySelector('#f-nd').disabled, f.querySelector('#f-nd').value]).toEqual([false, false, '']);
  });
});

test('#135 / #136 прототип: у погодженому звіті — бюджет, витрати, прогноз завжди; «Планувалось» — з попереднього звіту з датою', () => {
  q('[data-act="nav"][data-page="reports"]').click();
  const n = qa('#main [data-act="repopen"]').length; expect(n).toBeGreaterThan(1);
  let withPlan = 0;
  for (let i = 0; i < n; i++) {
    qa('#main [data-act="repopen"]')[i].click();
    ['budgetPlan', 'actualCost', 'forecastCost'].forEach(k => expect(q('#rv-' + k)).not.toBeNull());
    const pl = q('#rv-plan');
    if (pl) { withPlan++; expect(pl.textContent).toMatch(/^Планувалось \(звіт від \d\d\.\d\d\.\d{4}\):/); }
  }
  expect(withPlan).toBeGreaterThan(0);
});
