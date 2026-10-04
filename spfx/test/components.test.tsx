/** @jest-environment jsdom */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { AppCtx } from '../src/webparts/pmoPortal/components/ctx';
import { MoneyIn } from '../src/webparts/pmoPortal/components/fields';
import { DataTable } from '../src/webparts/pmoPortal/components/DataTable';
import { reportCard, riskCard, TableDefs } from '../src/webparts/pmoPortal/components/defs';
import { makeT } from '../src/webparts/pmoPortal/i18n/i18n';
import { T } from '../src/webparts/pmoPortal/i18n/strings';

// Компоненты приложения в jsdom: поведение, а не только «вызывается» (блок 2 отзывов раунда 3 и правки кросс-ревью)
const tt = makeT(0);
const ctx = { ...tt, lang: 0, today: '2026-10-04', me: 'pm@x', webUrl: '', views: {}, go() { /* */ }, setView() { /* */ }, openProject() { /* */ },
  openForm() { /* */ }, repo: {}, canCreate: false, reload: async () => undefined, toast() { /* */ } } as any;
let root: HTMLDivElement;
beforeEach(() => { root = document.createElement('div'); document.body.appendChild(root); localStorage.clear(); });
afterEach(() => { ReactDOM.unmountComponentAtNode(root); root.remove(); });
const mount = (el: React.ReactElement): void => { act(() => { ReactDOM.render(<AppCtx.Provider value={ctx}>{el}</AppCtx.Provider>, root); }); };

describe('#41 / #45 поле суммы MoneyIn', () => {
  const Host: React.FC<{ init: number; seen: number[] }> = ({ init, seen }) => {
    const [v, setV] = React.useState(init);
    return <MoneyIn id="m" value={v} onChange={n => { seen.push(n); setV(n); }} />;
  };
  test('вне фокуса — с разрядами, в фокусе — цифры, ввод — число, уход — снова с разрядами', () => {
    const seen: number[] = []; mount(<Host init={1450000} seen={seen} />);
    const i = root.querySelector('#m') as HTMLInputElement;
    expect(i.value).toBe('1 450 000');
    act(() => { Simulate.focus(i); }); expect(i.value).toBe('1450000');
    act(() => { Simulate.change(i, { target: { value: '2400000' } } as any); }); expect(seen[seen.length - 1]).toBe(2400000);
    act(() => { Simulate.blur(i); }); expect(i.value).toBe('2 400 000');
  });
  test('кросс-ревью: ноль в фокусе — пустое поле; вставка «1450.50» — 1451 (не 145050)', () => {
    const seen: number[] = []; mount(<Host init={0} seen={seen} />);
    const i = root.querySelector('#m') as HTMLInputElement;
    expect(i.value).toBe('0');
    act(() => { Simulate.focus(i); }); expect(i.value).toBe('');
    act(() => { Simulate.change(i, { target: { value: '1450.50' } } as any); }); expect(seen[seen.length - 1]).toBe(1451);
    act(() => { Simulate.blur(i); }); expect(i.value).toBe('1 451');
  });
});

describe('DataTable: #35 / #49 ширина колонок, #58 карточки', () => {
  type Row = { id: number; a: string; b: string };
  const defs: TableDefs<Row> = { lock: 'a', defaults: ['a', 'b'], cols: {
    a: { label: 'A', cell: (r: Row) => r.a, sort: (r: Row) => r.a }, b: { label: 'B', cell: (r: Row) => r.b, sort: (r: Row) => r.b } } } as any;
  const rows: Row[] = [{ id: 1, a: 'x', b: 'y' }, { id: 2, a: 'z', b: 'w' }];
  let restore: () => void;
  beforeEach(() => {
    // jsdom не раскладывает страницу: «замер» — 120 px на колонку, таблица видна
    const gbr = Element.prototype.getBoundingClientRect, cw = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Element.prototype.getBoundingClientRect = function (): DOMRect { return { width: 120, height: 30, x: 0, y: 0, top: 0, left: 0, right: 120, bottom: 30, toJSON() { /* */ } } as DOMRect; };
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
    (window as any).innerWidth = 1280;
    restore = () => { Element.prototype.getBoundingClientRect = gbr; if (cw) Object.defineProperty(HTMLElement.prototype, 'clientWidth', cw); };
  });
  afterEach(() => restore());
  const ev = (type: string, x: number, button = 0): MouseEvent => new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, button });
  const colW = (k: number): string => (root.querySelectorAll('col')[k] as HTMLElement).style.width;

  test('перетаскивание: живая ширина, по отпусканию — запомнена для списка', () => {
    mount(<DataTable tkey="t1" defs={defs} rows={rows} />);
    const h = root.querySelectorAll('.col-rs')[1] as HTMLElement;
    expect(h).toBeDefined();
    act(() => { h.dispatchEvent(ev('pointerdown', 100)); });
    act(() => { window.dispatchEvent(ev('pointermove', 150)); });
    expect(colW(1)).toBe('170px');
    act(() => { window.dispatchEvent(ev('pointerup', 160)); });
    expect(colW(1)).toBe('180px');
    expect(JSON.parse(localStorage.getItem('pmo-table6-t1') as string).w).toEqual({ b: 180 });
  });
  test('кросс-ревью: отмена жеста — ширина прежняя и не сохраняется; правая кнопка — не тянет', () => {
    mount(<DataTable tkey="t2" defs={defs} rows={rows} />);
    const h = root.querySelectorAll('.col-rs')[1] as HTMLElement;
    act(() => { h.dispatchEvent(ev('pointerdown', 100)); });
    act(() => { window.dispatchEvent(ev('pointermove', 180)); }); expect(colW(1)).toBe('200px');
    act(() => { window.dispatchEvent(ev('pointercancel', 180)); }); expect(colW(1)).toBe('120px');
    act(() => { window.dispatchEvent(ev('pointerup', 300)); });   // после отмены слушателей нет
    expect(localStorage.getItem('pmo-table6-t2')).toBeNull();
    act(() => { h.dispatchEvent(ev('pointerdown', 100, 2)); });
    act(() => { window.dispatchEvent(ev('pointermove', 200)); }); expect(colW(1)).toBe('120px');
  });
  test('#58: карточки — те же строки, что в таблице', () => {
    mount(<DataTable tkey="t3" defs={defs} rows={rows} card={r => <button className="mcard">{r.a}</button>} />);
    expect(root.querySelector('.tablewrap.dt.has-cards')).not.toBeNull();
    expect(Array.from(root.querySelectorAll('.mcards .mcard')).map(x => x.textContent)).toEqual(Array.from(root.querySelectorAll('tbody tr')).map(tr => tr.children[0].textContent));
  });
});

describe('#58 карточки отчёта и риска', () => {
  const opened: string[] = [];
  const x = { t: tt.t, fl: tt.fl, today: '2026-10-04', byId: { 5: { id: 5, title: 'Проєкт П' } }, comments: [],
    open() { /* */ }, openRisk: (id: number, p: number) => opened.push(`risk ${id}/${p}`), openReport: (id: number, p: number) => opened.push(`rep ${id}/${p}`) } as any;
  test('отчёт: проект, дата, стан, погодження, резюме; нажатие открывает отчёт', () => {
    mount(<>{reportCard(x)({ id: 7, projectId: 5, date: '2026-10-02', schedule: 'Зелений', budget: 'Жовтий', resources: 'Зелений', approval: 'На погодженні', title: 'Резюме' } as any)}</>);
    const t = root.textContent || '';
    ['Проєкт П', '02.10.2026', 'Жовтий', 'На погодженні', 'Резюме'].forEach(s => expect(t).toContain(s));
    act(() => { (root.querySelector('.mcard') as HTMLElement).click(); }); expect(opened).toContain('rep 7/5');
  });
  test('риск: название, оценка, проект, статус, срок; нажатие открывает риск', () => {
    mount(<>{riskCard(x)({ id: 3, projectId: 5, title: 'Ризик Р', probability: 3, impact: 5, status: 'Відкрито', due: '2026-10-20' } as any)}</>);
    const t = root.textContent || '';
    ['Ризик Р', '15', 'Проєкт П', 'Відкрито', '20.10.2026'].forEach(s => expect(t).toContain(s));
    act(() => { (root.querySelector('.mcard') as HTMLElement).click(); }); expect(opened).toContain('risk 3/5');
  });
});

test('#42: кнопка карточки — «Редагувати проєкт»', () => { expect(T.editProject).toEqual(['Редагувати проєкт', 'Edit project', 'Редактировать проект']); });
test('#38 / #39: в форме отчёта статус, % и затраты — один ряд .fgrid-k, оценки — в .dims', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/webparts/pmoPortal/panels/ReportForm.tsx'), 'utf8');
  const row = src.slice(src.indexOf('<div className="fgrid-k frow">'), src.indexOf('</div>\n        </div>', src.indexOf('<div className="fgrid-k frow">')) + 20);
  ['id="f-st"', 'id="f-pr"', 'id="f-c"'].forEach(id => expect(row).toContain(id));
  expect((src.match(/<RagPick name="(sched|budget|res)"/g) || []).length).toBe(3);
});

test('«Відгуки»: номер отзыва (#N) — первая колонка, по нему сортируется', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/webparts/pmoPortal/pages/Feedback.tsx'), 'utf8');
  expect(src).toMatch(/defaults: \['num', 'date'/);
  expect(src).toMatch(/num: \{ label: t\('fbNum'\), cell: r => <button className="linklike" onClick=\{\(\) => open\(r\)\}>#\{r\.id\}<\/button>, sort: r => r\.id/);
  expect(T.fbNum || (require('../src/webparts/pmoPortal/i18n/strings') as any).EXTRA.fbNum).toEqual(['№', 'No.', '№']);
});
