import * as fs from 'fs';
import * as path from 'path';
import { T } from '../src/webparts/pmoPortal/i18n/strings';

// Прототип — эталон интерфейса: те же сценарии формы статус-отчёта (tests/cases/report-form.json), что и в reportForm.test.ts,
// прогоняются на настоящем prototype/pmo-prototype.html в jsdom. Расхождение прототипа и приложения роняет тест.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JSDOM } = require('jsdom');
const V = JSON.parse(fs.readFileSync(path.join(__dirname, '../../tests/cases/report-form.json'), 'utf8'));
const HTML = fs.readFileSync(path.join(__dirname, '../../prototype/pmo-prototype.html'), 'utf8');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = any;
let w: W;
const tick = (): Promise<void> => new Promise(r => setTimeout(r, 0));
// каждый тест — на свежем прототипе: сохранённые отчёты одного сценария не влияют на другой
beforeEach(async () => {
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://pmo.test/',
    beforeParse(win: W) {
      win.matchMedia = () => ({ matches: false, addEventListener() { /* */ }, removeEventListener() { /* */ }, addListener() { /* */ } });
      win.HTMLElement.prototype.scrollIntoView = function (): void { /* */ };
      win.scrollTo = () => undefined;
    }
  });
  w = dom.window;
  for (let i = 0; i < 20 && !w.document.querySelector('[data-act="lang"]'); i++) await tick();
  w.document.querySelector('[data-act="lang"][data-i="0"]').click();
  await tick();
});
afterEach(() => { if (w) w.close(); });

const ev = (el: W, type: string): void => { el.dispatchEvent(new w.Event(type, { bubbles: true })); };
const q = (sel: string): W => w.document.querySelector(sel);
const click = (sel: string): void => { const el = q(sel); if (!el) throw new Error('нет элемента ' + sel); el.click(); };
/** Общая форма «Новий статус-звіт» (вкладка «Статус-звіти»): по умолчанию — первый проект без отчёта на погодженні. */
function openForm(): { form: W; g: (id: string) => W } {
  click('[data-act="nav"][data-page="reports"]');
  click('[data-act="newrep"]:not([data-id])');
  const form = q('#repform');
  if (!form) throw new Error('форма отчёта в прототипе не открылась');
  return { form, g: (id: string) => form.querySelector('#' + id) };
}
/** Форма из карточки проекта (кнопка «Додати статус-звіт» есть только у проекта без отчёта на погодженні). */
function openFromCard(): W {
  click('[data-act="nav"][data-page="projects"]');
  const ids = Array.from(w.document.querySelectorAll('[data-act="openp"]')).map((x: W) => x.dataset.id);
  for (const id of ids) {
    click(`[data-act="openp"][data-id="${id}"]`);
    const b = q(`[data-act="newrep"][data-id="${id}"]`);
    if (b) { b.click(); return q('#repform'); }
  }
  throw new Error('нет проекта, где можно добавить отчёт из карточки');
}
const setVal = (el: W, v: string): void => { el.value = v; ev(el, 'input'); ev(el, 'change'); };
const setStatus = (g: (id: string) => W, st: string): void => { const s = g('f-st'); s.value = st; ev(s, 'change'); };
const FIELD: Record<string, string> = { 'f-d': 'date', 'f-kr': 'keyReason', 'f-t': 'title', 'f-pr': 'progress', 'f-golive': 'goLive', 'f-plan': 'planEnd', 'f-fc': 'forecastEnd' };

test('прототип: #37 из карточки проект зафиксирован; #51 проекты с отчётом на погодженні недоступны', () => {
  const form = openFromCard();
  expect(form.querySelector('.fixedval')).not.toBeNull();
  expect(form.querySelector('select#f-p')).toBeNull();
  const { form: f2 } = openForm();
  const sel = f2.querySelector('select#f-p');
  const marker = T.repPendingOpt[0].replace('{date}', '');
  const pend = Array.from(sel.options).filter((o: W) => o.textContent.indexOf(marker.split(' ')[0]) >= 0 && /на погодженні/.test(o.textContent));
  expect(pend.length).toBeGreaterThan(0);                                   // в демо-данных прототипа есть отчёт на погодженні
  pend.forEach((o: W) => { if (o.value !== sel.value) expect(o.disabled).toBe(true); });
  expect(pend.some((o: W) => o.value === sel.value)).toBe(false);           // по умолчанию выбран проект без отчёта на погодженні
});

describe('прототип: статус и % (#52)', () => {
  for (const c of V.status) test(c.name, () => {
    const { g } = openForm();
    setStatus(g, c.start.status);
    if (c.start.status !== 'Завершено') setVal(g('f-pr'), String(c.start.progress));
    else { /* черновик «Завершено»: поле закрыто и 100 сразу */ }
    for (const st of c.steps) setStatus(g, st);
    const pr = g('f-pr');
    expect(Number(pr.value)).toBe(c.out.progress);
    expect(pr.disabled).toBe(c.out.locked);
  });
});

describe('прототип: проверка формы (#40, #53, #54)', () => {
  for (const c of V.validation) test(c.name, () => {
    const { form, g } = openForm();
    const d = c.draft;
    setStatus(g, d.status);
    for (const [k, n] of [['schedule', 'sched'], ['budget', 'budget'], ['resources', 'res']]) {
      form.querySelectorAll(`input[name="${n}"]`).forEach((x: W) => { x.checked = !!d[k] && x.value === d[k]; });
    }
    setVal(g('f-start'), d.start); setVal(g('f-golive'), d.goLive); setVal(g('f-plan'), d.planEnd); setVal(g('f-fc'), d.forecastEnd);
    if (!g('f-pr').disabled) setVal(g('f-pr'), c.progressText);
    setVal(g('f-t'), d.title); setVal(g('f-kr'), d.keyReason);
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    const got = Array.from(form.querySelectorAll('[aria-invalid="true"]')).map((el: W) => {
      if (el.tagName === 'FIELDSET') return (el.querySelector('input[type=radio]') || {}).name;
      return FIELD[el.id] || el.id;
    }).map((x: string) => (x === 'sched' || x === 'budget' || x === 'res' ? x : x));
    expect(got.sort()).toEqual([...c.out].sort());
    const msg = form.querySelector('.err');
    if (c.message) { expect(msg.hidden).toBe(false); expect(msg.textContent).toBe(T[c.message][0]); }
    else expect(msg.hidden && !got.length).toBe(true);
  });
});


describe('прототип: смена проекта', () => {
  for (const c of V.projectSwitch) test(c.name, () => {
    const { g } = openForm();
    setStatus(g, c.status);
    const sel = g('f-p');
    const other: W = Array.from(sel.options).filter((o: W) => !o.disabled && o.value !== sel.value)[0];
    expect(other).toBeDefined();
    sel.value = other.value; ev(sel, 'change');
    expect(g('f-pr').disabled).toBe(c.out.locked);
    expect(g('f-pr-done').hidden).toBe(true);
  });
});
