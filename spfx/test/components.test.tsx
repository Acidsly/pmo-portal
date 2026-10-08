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
import { RiskForm } from '../src/webparts/pmoPortal/panels/RiskForm';
import { ReportForm } from '../src/webparts/pmoPortal/panels/ReportForm';
import { AssignForm } from '../src/webparts/pmoPortal/panels/AssignForm';
import { ProjectForm } from '../src/webparts/pmoPortal/panels/ProjectForm';
import { RefLink } from '../src/webparts/pmoPortal/panels/ProjectCard';
import { NotifyPanel } from '../src/webparts/pmoPortal/panels/NotifyPanel';
import { Header } from '../src/webparts/pmoPortal/components/Header';
import { RepMark, FreshDate, freshTip } from '../src/webparts/pmoPortal/components/Bits';
import { FeedbackView } from '../src/webparts/pmoPortal/panels/FeedbackView';
import { neighbors } from '../src/webparts/pmoPortal/logic/ui';

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

describe('#47 / #55 форма риска', () => {
  const data = { projects: [{ id: 5, title: 'Проєкт П', status: 'Реалізація', canEdit: true, manager: { email: 'pm@x', name: 'PM' } }], risks: [], reports: [], comments: [], team: [] } as any;
  test('тип — перед «Опис»; заголовок новой записи — по типу; кнопки — «ризик / проблема»', () => {
    mount(<RiskForm data={data} projectId={5} riskId={0} onCancel={() => undefined} />);
    const ty = root.querySelector('fieldset.ragpick') as HTMLElement, ta = root.querySelector('#k-title') as HTMLElement;
    expect(ty.compareDocumentPosition(ta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((root.querySelector('label[for="k-title"]') as HTMLElement).textContent).toContain('Опис');
    expect((root.querySelector('.ph h2') as HTMLElement).textContent).toBe('Новий ризик');
    act(() => { Simulate.change(root.querySelector('input[name="k-type"][value="Проблема"]') as HTMLInputElement); });
    expect((root.querySelector('.ph h2') as HTMLElement).textContent).toBe('Нова проблема');
    expect(T.newRisk[0]).toBe('Новий ризик / проблема'); expect(T.addRisk[0]).toBe('Додати ризик / проблему');
  });
});

describe('#54 форма отчёта: дата завершення (факт)', () => {
  const data = { projects: [{ id: 5, title: 'Проєкт П', status: 'Реалізація', type: 'Звичайний', progress: 40, actualCost: 0, start: '2026-03-02', goLive: '', planEnd: '2026-12-01', forecastEnd: '',
    canEdit: true, manager: { email: 'pm@x', name: 'PM' } }], risks: [], reports: [], comments: [], team: [] } as any;
  const typeDate = (id: string, v: string): void => { act(() => { Simulate.change(root.querySelector('#' + id) as HTMLInputElement, { target: { value: v } } as any); }); };
  test('поле только при «Скасовано» / «Завершено»; без даты и позже даты отчёта — ошибка у поля', () => {
    mount(<ReportForm data={data} projectId={5} onCancel={() => undefined} />);
    expect(root.querySelector('#f-ae')).toBeNull();
    const st = root.querySelector('#f-st') as HTMLSelectElement;
    act(() => { Simulate.change(st, { target: { value: 'Скасовано' } } as any); });
    expect(root.querySelector('#f-ae')).not.toBeNull();
    expect((root.querySelector('label[for="f-ae"]') as HTMLElement).textContent).toContain('Дата завершення (факт)');
    act(() => { Simulate.submit(root.querySelector('form') as HTMLFormElement); });
    expect((root.querySelector('#f-ae') as HTMLElement).getAttribute('aria-invalid')).toBe('true');
    typeDate('f-ae', '05.10.2026');                 // позже даты отчёта (сегодня 04.10.2026)
    act(() => { Simulate.submit(root.querySelector('form') as HTMLFormElement); });
    expect(root.textContent).toContain('Не може бути пізніше дати звіту.');
    act(() => { Simulate.change(st, { target: { value: 'Реалізація' } } as any); });
    expect(root.querySelector('#f-ae')).toBeNull();
    act(() => { Simulate.change(st, { target: { value: 'Завершено' } } as any); });
    expect(root.querySelector('#f-ae')).not.toBeNull();
  });
});

describe('#43 «Змінити PM / власника» — только PMO', () => {
  const pr = { id: 5, code: 'PRJ-005', title: 'Проєкт П', status: 'Реалізація', canEdit: false, manager: { id: 1, email: 'pm@x', name: 'Старий PM' }, owner: null,
    links: [], team: [], department: 'ІТ', priority: '', budget: 0, description: '' };
  const data = (x: any = {}): any => ({ projects: [{ ...pr, ...x }], risks: [], reports: [], comments: [], team: [], canApprove: true });
  const pick = async (id: string, who: string): Promise<void> => {
    jest.useFakeTimers();
    act(() => { Simulate.change(root.querySelector('#' + id) as HTMLInputElement, { target: { value: who } } as any); });
    await act(async () => { jest.advanceTimersByTime(300); await Promise.resolve(); });
    jest.useRealTimers();
    const opt = root.querySelector('.picker-list .pop-row') as HTMLElement;
    act(() => { Simulate.mouseDown(opt); });
  };
  test('ничего не выбрано — ошибка; без комментария — ошибка; иначе запись в «Призначення» папки проекта', async () => {
    const calls: any[] = [];
    const repo = { searchPeople: async () => [{ id: 0, email: 'New@x', name: 'Новий PM' }], fresh: async () => ({ project: pr, pending: [], assigns: 0 }),
      createIn: async (...a: any[]) => { calls.push(a); return 9; } };
    const c2 = { ...ctx, repo, reload: async () => undefined, toast() { /* */ }, openProject() { /* */ } };
    act(() => { ReactDOM.render(<AppCtx.Provider value={c2}><AssignForm data={data()} projectId={5} onCancel={() => undefined} /></AppCtx.Provider>, root); });
    const submit = async (): Promise<void> => { await act(async () => { Simulate.submit(root.querySelector('form') as HTMLFormElement); await Promise.resolve(); }); };
    await submit(); expect(root.textContent).toContain('Оберіть нового PM або нового власника.');
    await pick('a-pm', 'Нов');
    await submit(); expect(root.textContent).toContain('Вкажіть причину зміни.');
    act(() => { Simulate.change(root.querySelector('#a-note') as HTMLTextAreaElement, { target: { value: 'Ротація' } } as any); });
    await submit(); await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(calls.length).toBe(1);
    expect(calls[0][0]).toBe('ProjectAssignments'); expect(calls[0][1]).toBe(5);
    expect(calls[0][2]).toMatchObject({ paProjectId: 5, paNote: 'Ротація', paApplied: false });
    expect(calls[0][3]).toEqual({ paManagerId: 'new@x', paOwnerId: '' });
  });
  test('не PMO, архив, уже ожидает — формы нет', () => {
    for (const d of [{ ...data(), canApprove: false }, data({ status: 'Архівний' }), data({ assignPending: true })]) {
      mount(<AssignForm data={d} projectId={5} onCancel={() => undefined} />);
      expect(root.querySelector('form')).toBeNull();
      ReactDOM.unmountComponentAtNode(root);
    }
  });
  test('у PM в форме проекта PM и власник — только чтение', () => {
    mount(<ProjectForm data={data({ canEdit: true })} project={{ ...pr, canEdit: true } as any} onCancel={() => undefined} />);
    expect((root.querySelector('#f-pm') as HTMLElement).tagName).toBe('DIV');
    expect((root.querySelector('#f-pm') as HTMLElement).textContent).toBe('Старий PM');
    expect(root.querySelector('#f-own input')).toBeNull();
    expect(root.textContent).toContain('PM і власника змінює лише PMO.');
  });
});

test('#46 / #48: ссылка из истории открывает отчёт или риск', () => {
  const opened: string[] = [];
  const c2 = { ...ctx, openForm: (f: string, id: number) => opened.push(`${f}@${id}`) };
  act(() => { ReactDOM.render(<AppCtx.Provider value={c2}><RefLink r={{ type: 'report', id: 12 }} pid={5} /><RefLink r={{ type: 'risk', id: 7 }} pid={5} /></AppCtx.Provider>, root); });
  const b = root.querySelectorAll('.chg-ref');
  expect(Array.from(b).map(x => x.textContent)).toEqual(['Відкрити звіт →', 'Відкрити ризик →']);
  act(() => { (b[0] as HTMLElement).click(); (b[1] as HTMLElement).click(); });
  expect(opened).toEqual(['rep:12@5', 'risk:7@5']);
});

describe('сповіщення: колокольчик и панель', () => {
  const person = (e: string, n = e): any => ({ id: 1, email: e, name: n });
  const now = new Date().toISOString();
  const data = (notify: any): any => ({ projects: [{ id: 1, code: 'PRJ-001', title: 'П1', status: 'Реалізація', manager: person('pm@x', 'PM'), owner: null, team: [], stakeholders: [] }],
    risks: [], reports: [], comments: [{ id: 7, projectId: 1, text: 'Новий коментар', author: person('au@x', 'Автор'), created: now }],
    recent: [{ id: 30, projectId: 1, date: now, who: person('au@x', 'Автор'), kind: 'Подання звіту', field: 'srApproval', from: '', to: 'На погодженні', reason: 'Звіт', item: 12 }],
    canApprove: false, notify });
  const head = (bell: any): void => mount(<Header page="home" lang={0} theme="light" userName="PM" userEmail="pm@x" onPage={() => undefined} onLang={() => undefined}
    onTheme={() => undefined} onHelp={() => undefined} bell={bell} />);
  test('шапка: число новых и покачивание только при новых; больше 9 — «9+»', () => {
    head({ unread: 3, onOpen: () => undefined }); expect(root.querySelector('#bell .dot-new')!.textContent).toBe('3'); expect(root.querySelector('#bell')!.className).toContain('has');
    ReactDOM.unmountComponentAtNode(root);
    head({ unread: 12, onOpen: () => undefined }); expect(root.querySelector('#bell .dot-new')!.textContent).toBe('9+');
    ReactDOM.unmountComponentAtNode(root);
    head({ unread: 0, onOpen: () => undefined }); expect(root.querySelector('#bell')).not.toBeNull(); expect(root.querySelector('#bell .dot-new')).toBeNull();
    expect(root.querySelector('#bell')!.className).not.toContain('has');
  });
  test('панель: мои новые события выделены; открытие ничего не пишет, «Позначити все прочитаним» — метки растут; нажатие открывает событие', async () => {
    const marked: any[] = []; const opened: string[] = [];
    const c2 = { ...ctx, me: 'pm@x', repo: { markRead: async (m: any) => { marked.push(m); } }, reload: async () => undefined };
    await act(async () => { ReactDOM.render(<AppCtx.Provider value={c2}><NotifyPanel data={data({ id: 1, readId: 20, readCmId: 5 })} onOpen={(f, id) => opened.push(`${f}@${id}`)} onCancel={() => undefined} /></AppCtx.Provider>, root); await Promise.resolve(); });
    const items = Array.from(root.querySelectorAll('.ntf-i'));
    expect(items.length).toBe(1);   // подача отчёта — только PMO; PM видит комментарий
    expect(items[0].className).toContain('new');
    expect(root.textContent).toContain('Новий коментар');
    expect(marked).toEqual([]);
    await act(async () => { (root.querySelector('#ntf-all') as HTMLElement).click(); await Promise.resolve(); });
    expect(marked).toEqual([{ readId: 20, readCmId: 7 }]);
    act(() => { (items[0] as HTMLElement).click(); }); expect(opened).toEqual(['@1']);
  });
  test('строки «Прочитане» ещё нет — подсказка, ничего не пишется', async () => {
    const marked: any[] = [];
    const c2 = { ...ctx, me: 'pm@x', repo: { markRead: async (m: any) => { marked.push(m); } } };
    await act(async () => { ReactDOM.render(<AppCtx.Provider value={c2}><NotifyPanel data={data(null)} onOpen={() => undefined} onCancel={() => undefined} /></AppCtx.Provider>, root); await Promise.resolve(); });
    expect(root.textContent).toContain('Сповіщення з\'являться протягом 15 хвилин.');
    expect(root.querySelector('#ntf-all')).toBeNull();
    expect(marked).toEqual([]);
  });
});

describe('отзыв: «попередній / наступний» по порядку таблицы', () => {
  const fb = (id: number): any => ({ id, created: '2026-10-01T10:00:00Z', author: 'А', screen: '', text: 'Відгук ' + id, status: 'Новий', answer: '', shots: 0, mine: true, files: [] });
  test('neighbors: середина, края, нет в порядке', () => {
    expect(neighbors([5, 3, 9], 3)).toEqual({ prev: 5, next: 9 });
    expect(neighbors([5, 3, 9], 5)).toEqual({ prev: 0, next: 3 });
    expect(neighbors([5, 3, 9], 9)).toEqual({ prev: 3, next: 0 });
    expect(neighbors([5, 3, 9], 7)).toEqual({ prev: 0, next: 0 });
  });
  test('окно отзыва: стрелки у номера ведут к соседям, на краю — неактивны', () => {
    const go: number[] = [];
    mount(<FeedbackView row={fb(3)} admin={false} order={[5, 3, 9]} onGo={n => go.push(n)} onCancel={() => undefined} />);
    expect(root.querySelector('.fb-nav')!.textContent).toContain('№3');
    act(() => { (root.querySelector('#fb-prev') as HTMLElement).click(); (root.querySelector('#fb-next') as HTMLElement).click(); });
    expect(go).toEqual([5, 9]);
    ReactDOM.unmountComponentAtNode(root);
    mount(<FeedbackView row={fb(5)} admin={false} order={[5, 3, 9]} onGo={n => go.push(n)} onCancel={() => undefined} />);
    expect((root.querySelector('#fb-prev') as HTMLButtonElement).disabled).toBe(true);
    expect((root.querySelector('#fb-next') as HTMLButtonElement).disabled).toBe(false);
  });
  test('таблица отдаёт строки в порядке экрана (сортировка)', () => {
    let shown: number[] = [];
    const defs: TableDefs<{ id: number }> = { lock: 'num', defaults: ['num'], cols: { num: { label: '№', cell: r => String(r.id), sort: r => r.id } } };
    mount(<DataTable tkey="t-shown" defs={defs} rows={[{ id: 2 }, { id: 1 }, { id: 3 }]} onShown={rs => { shown = rs.map(r => r.id); }} />);
    const before = shown.slice();
    act(() => { (root.querySelector('.sortb') as HTMLElement).click(); });
    expect(before).toEqual([2, 1, 3]);
    expect(shown).toEqual([1, 2, 3]);
  });
});

describe('метка погодження в колонке «Звіт»', () => {
  test('«Погоджено» — без даты; «Повернуто» и «На погодженні» — с датой отчёта; нет отчётов — пусто', () => {
    mount(<RepMark r={{ approval: 'Погоджено', date: '2026-09-25' }} />);
    expect(root.querySelector('.rep-ap .pill')!.textContent).toBe('Погоджено'); expect(root.querySelector('.rep-ap .muted')).toBeNull();
    ReactDOM.unmountComponentAtNode(root);
    mount(<RepMark r={{ approval: 'Повернуто', date: '2026-10-01' }} />);
    expect(root.textContent).toContain('Повернуто'); expect(root.querySelector('.rep-ap .muted')!.textContent).toBe(new Date('2026-10-01T12:00:00Z').toLocaleDateString('uk-UA'));
    ReactDOM.unmountComponentAtNode(root);
    mount(<RepMark r={null} />); expect(root.querySelector('.rep-ap')).toBeNull();
  });
});

describe('подсказка к точке свежести в колонке «Звіт»', () => {
  test('дни с последнего погодженого отчёта и значение цветов; без отчётов — «ще немає»', () => {
    expect(freshTip(tt.t, '2026-09-25', '2026-10-08')).toBe('Останній погоджений звіт — 13 дн. тому. Зелений — до 8 днів, жовтий — 9–14, червоний — понад 14.');
    expect(freshTip(tt.t, '', '2026-10-08')).toBe('Погоджених звітів ще немає.');
    mount(<FreshDate iso="2026-09-25" fresh="y" none="—" tip={freshTip(tt.t, '2026-09-25', '2026-10-08')} />);
    expect(root.querySelector('.rag')!.getAttribute('title')).toContain('13 дн. тому');
  });
});
