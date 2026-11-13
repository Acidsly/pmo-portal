/** @jest-environment jsdom */
import * as React from 'react';
import { act } from 'react';
import { Simulate } from 'react-dom/test-utils';
import { renderInto, disposeRoot } from '../src/webparts/pmoPortal/components/reactRoot';
import { AppCtx } from '../src/webparts/pmoPortal/components/ctx';
import { makeT } from '../src/webparts/pmoPortal/i18n/i18n';
import { T } from '../src/webparts/pmoPortal/i18n/strings';

// Сверка покрытия отзывов 29–53 (раунд 2): поведение приложения, которое не проверял ни один тест
jest.mock('@microsoft/sp-http', () => ({ SPHttpClient: { configurations: { v1: {} } } }));
jest.mock('../src/webparts/pmoPortal/theme/prototype.scss', () => ({}));
jest.mock('../src/webparts/pmoPortal/theme/overrides.scss', () => ({}));
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
const { App } = require('../src/webparts/pmoPortal/components/App');

const tt = makeT(0);
const ctx: any = { ...tt, lang: 0, today: '2026-10-04', me: 'pm@x', webUrl: '', views: {}, go() { /* */ }, setView() { /* */ }, openProject() { /* */ },
  openForm() { /* */ }, repo: {}, canCreate: false, reload: async () => undefined, toast() { /* */ } };
let root: HTMLDivElement;
beforeEach(() => { root = document.createElement('div'); document.body.appendChild(root); localStorage.clear(); });
afterEach(() => { act(() => { disposeRoot(root); }); root.remove(); });
const mount = (el: React.ReactElement, c: any = ctx): void => { act(() => { renderInto(root, <AppCtx.Provider value={c}>{el}</AppCtx.Provider>); }); };

// #31: открытая страница сама проверяет свежесть — при возврате на вкладку и раз в 5 минут; перечитывает, только если данные изменились
describe('#31 страница обновляется сама', () => {
  const emptyData = { projects: [], reports: [], risks: [], comments: [], changes: [], canCreate: false, canApprove: false, approvals: [], feedback: false,
    feedbackAdmin: false, feedbackRows: [], recent: [], notify: null };
  const setVis = (v: string): void => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v }); };
  afterEach(() => { jest.useRealTimers(); setVis('visible'); });
  const start = async (stamps: string[]): Promise<{ loads: () => number; stamps: () => number }> => {
    jest.useFakeTimers();
    let nLoad = 0, nStamp = 0;
    const repo = { loadAll: async () => { nLoad++; return emptyData; }, stamp: async () => stamps[Math.min(nStamp++, stamps.length - 1)] };
    await act(async () => { renderInto(root, <App repo={repo} culture="uk-UA" userName="PM" userEmail="pm@x" webUrl="" />); await Promise.resolve(); await Promise.resolve(); });
    return { loads: () => nLoad, stamps: () => nStamp };
  };
  const flush = async (): Promise<void> => { await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); }); };

  test('возврат на вкладку: изменилось — перечитать; не изменилось — нет; скрытая вкладка — не проверять', async () => {
    setVis('visible');
    const s = await start(['s1', 's1', 's2']);
    expect(s.loads()).toBe(1);
    document.dispatchEvent(new Event('visibilitychange')); await flush();
    expect([s.stamps(), s.loads()]).toEqual([2, 1]);            // та же отметка — данные не перечитываются
    setVis('hidden'); document.dispatchEvent(new Event('visibilitychange')); await flush();
    expect(s.stamps()).toBe(2);                                  // вкладка скрыта — запроса нет
    setVis('visible'); document.dispatchEvent(new Event('visibilitychange')); await flush();
    expect([s.stamps(), s.loads()]).toEqual([4, 2]);            // изменилось — перечитано (с новой отметкой)
  });
  test('раз в 5 минут — проверка отметки; раньше — нет', async () => {
    setVis('visible');
    const s = await start(['s1', 's2']);
    act(() => { jest.advanceTimersByTime(4 * 60000); }); await flush();
    expect(s.stamps()).toBe(1);
    act(() => { jest.advanceTimersByTime(60000); }); await flush();
    expect([s.stamps(), s.loads()]).toEqual([3, 2]);            // проверка + перечитывание с отметкой
  });
});

const { projectDefs } = require('../src/webparts/pmoPortal/components/defs');
const { Tiles } = require('../src/webparts/pmoPortal/components/Tiles');
const { DataTable } = require('../src/webparts/pmoPortal/components/DataTable');
const { ReportForm } = require('../src/webparts/pmoPortal/panels/ReportForm');
const { ProjectForm } = require('../src/webparts/pmoPortal/panels/ProjectForm');
const { RiskForm } = require('../src/webparts/pmoPortal/panels/RiskForm');
const { Risks } = require('../src/webparts/pmoPortal/pages/Risks');
const { archiveView } = require('../src/webparts/pmoPortal/logic/views');

const proj = (x: any = {}): any => ({ id: 5, code: 'PRJ-005', title: 'Проєкт П', type: 'Звичайний', priority: '', manager: { id: 1, name: 'PM', email: 'pm@x' }, owner: null, stakeholders: [],
  department: 'ІТ', status: 'Реалізація', rag: '', progress: 40, start: '2026-03-02', goLive: '', planEnd: '2026-12-01', forecastEnd: '', archivedAt: '', budget: 0, actualCost: 0,
  lastUpdate: '', lastReport: '', lastComment: '', links: [], team: [], description: 'Мета', canEdit: true, pending: false, ...x });
const dmy = (iso: string): string => new Date(iso + 'T12:00:00Z').toLocaleDateString('uk-UA');

// #29: звіт на погодженні видно в колонці «Звіт» і на плитці — і без погоджених звітів, і поруч із датою останнього погодженого
describe('#29 колонка «Звіт» и плитка: отчёт на погодженні', () => {
  const x = { t: tt.t, fl: tt.fl, today: '2026-10-04', byId: {}, comments: [], open() { /* */ }, openRisk() { /* */ }, openReport() { /* */ } };
  const cases: Array<[string, any, string[]]> = [
    ['погоджених нет, первый отчёт на погодженні', { lastUpdate: '', lastRep: { approval: 'На погодженні', date: '2026-10-02' } }, [tt.t('noReports'), 'На погодженні', dmy('2026-10-02')]],
    ['есть погоджений, новый на погодженні', { lastUpdate: '2026-09-20', lastRep: { approval: 'На погодженні', date: '2026-10-02' } }, [dmy('2026-09-20'), 'На погодженні', dmy('2026-10-02')]],
    ['новый повернуто', { lastUpdate: '2026-09-20', lastRep: { approval: 'Повернуто', date: '2026-10-01' } }, [dmy('2026-09-20'), 'Повернуто', dmy('2026-10-01')]]];
  test.each(cases)('%s', (_n, p, want) => {
    mount(<>{projectDefs(x, false).cols.repDate.cell(proj(p))}</>);
    const txt = root.textContent || '';
    want.forEach(s => expect(txt).toContain(s));
    act(() => { disposeRoot(root); });
    mount(<Tiles rows={[proj(p)]} />);
    want.forEach(s => expect(root.querySelector('.tile-upd')!.textContent).toContain(s));
  });
  test('без отчётов — только «Немає звітів», метки нет', () => {
    mount(<>{projectDefs(x, false).cols.repDate.cell(proj({ lastRep: null }))}</>);
    expect(root.textContent).toContain(tt.t('noReports')); expect(root.querySelector('.rep-ap')).toBeNull();
  });
});

// #33: ширины колонок на широком экране не меняются от фильтра (строк стало меньше — замер другой, ширины прежние)
describe('#33 ширины колонок закреплены', () => {
  let restore: () => void;
  beforeEach(() => {
    const gbr = Element.prototype.getBoundingClientRect, cw = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'), iw = window.innerWidth;
    // «раскладка по содержимому»: ширина заголовка зависит от числа строк таблицы
    Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
      const t = this.closest('table'); const n = t ? t.querySelectorAll('tbody tr').length : 1;
      return { width: 50 + 10 * n, height: 30, x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 30, toJSON() { /* */ } } as DOMRect;
    };
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
    restore = () => { Element.prototype.getBoundingClientRect = gbr; if (cw) Object.defineProperty(HTMLElement.prototype, 'clientWidth', cw); (window as any).innerWidth = iw; };
  });
  afterEach(() => restore());
  const defs = { lock: 'a', defaults: ['a', 'b'], cols: { a: { label: 'A', cell: (r: any) => r.a, sort: (r: any) => r.a, filter: (r: any) => r.a }, b: { label: 'B', cell: (r: any) => r.b } } };
  const rows = [{ id: 1, a: 'x', b: '1' }, { id: 2, a: 'y', b: '2' }, { id: 3, a: 'y', b: '3' }, { id: 4, a: 'z', b: '4' }];
  const widths = (): string[] => Array.from(root.querySelectorAll('col')).map(c => (c as HTMLElement).style.width);
  test('широкий экран: меньше строк (фильтр / вид) — ширины те же', () => {
    (window as any).innerWidth = 1280;
    mount(<DataTable tkey="w33" defs={defs} rows={rows} />);
    const w0 = widths(); expect(w0.length).toBe(2);
    mount(<DataTable tkey="w33" defs={defs} rows={rows.slice(0, 1)} />);
    expect(widths()).toEqual(w0);
  });
  test('телефон / планшет — без закрепления', () => {
    (window as any).innerWidth = 800;
    mount(<DataTable tkey="w33m" defs={defs} rows={rows} />);
    expect(root.querySelector('colgroup')).toBeNull();
  });
});

// #49: порядок колонок — кнопками ↑ / ↓ в меню колонок, запоминается отдельно для каждого списка
test('#49 меню колонок: ↓ переставляет колонку, порядок запомнен для этого списка', () => {
  const defs = { lock: 'a', defaults: ['a', 'b', 'c'], cols: { a: { label: 'A', cell: (r: any) => r.a }, b: { label: 'B', cell: () => 'b' }, c: { label: 'C', cell: () => 'c' } } };
  const heads = (): string[] => Array.from(root.querySelectorAll('thead th')).map(th => th.textContent || '');
  mount(<DataTable tkey="ord49" defs={defs} rows={[{ id: 1, a: 'a' }]} />);
  expect(heads()).toEqual(['A', 'B', 'C']);
  act(() => { (root.querySelector('.gear-lg') as HTMLElement).click(); });
  const rowB = Array.from(document.querySelectorAll('.pmo-pop .col-row')).filter(r => /B/.test(r.textContent || ''))[0] as HTMLElement;
  act(() => { (rowB.querySelector('button[aria-label="↓"]') as HTMLElement).click(); });
  expect(heads()).toEqual(['A', 'C', 'B']);
  expect(JSON.parse(localStorage.getItem('pmo-table6-ord49') as string).cols).toEqual(['a', 'c', 'b']);
  act(() => { disposeRoot(root); });
  mount(<DataTable tkey="ord49" defs={defs} rows={[{ id: 1, a: 'a' }]} />);
  expect(heads()).toEqual(['A', 'C', 'B']);                       // после перезагрузки — тот же порядок
  act(() => { disposeRoot(root); });
  mount(<DataTable tkey="other49" defs={defs} rows={[{ id: 1, a: 'a' }]} />);
  expect(heads()).toEqual(['A', 'B', 'C']);                       // другой список — свой порядок
});
test('#49 ширина и порядок — во всех пяти списках (своя таблица с колонками и свой ключ)', () => {
  const fs = require('fs'), path = require('path');
  const keys = ['Projects', 'Archive', 'Reports', 'Risks', 'Feedback'].map(f => {
    const src = fs.readFileSync(path.join(__dirname, `../src/webparts/pmoPortal/pages/${f}.tsx`), 'utf8');
    const m = /<DataTable tkey="([^"]+)"/.exec(src); expect(m).not.toBeNull(); return m![1];
  });
  expect(new Set(keys).size).toBe(5);
});

// форма статус-отчёта в приложении: #37 проект из карточки, #51 отчёт на погодженні, #52 / #53 «% виконання», #40 сообщение, #38 / #39 раскладка
describe('форма статус-отчёта (компонент)', () => {
  const data = (ps: any[]): any => ({ projects: ps, risks: [], reports: [], comments: [], team: [], approvals: [] });
  const two = [proj({ id: 5, title: 'Проєкт П' }), proj({ id: 6, title: 'Проєкт Q', pendingDate: '2026-10-02' }), proj({ id: 7, title: 'Проєкт R' })];
  test('#37 из карточки — названия проекта, выбора нет; из «Статус-звіти» — выбор есть', () => {
    mount(<ReportForm data={data(two)} projectId={7} onCancel={() => undefined} />);
    expect(root.querySelector('select#f-p')).toBeNull();
    expect(root.querySelector('.fixedval')!.textContent).toBe('Проєкт R');
    act(() => { disposeRoot(root); });
    mount(<ReportForm data={data(two)} projectId={0} onCancel={() => undefined} />);
    expect(root.querySelector('select#f-p')).not.toBeNull();
  });
  test('#51 общая форма: проект с отчётом на погодженні — недоступен и помечен, по умолчанию — без него', () => {
    mount(<ReportForm data={data(two)} projectId={0} onCancel={() => undefined} />);
    const sel = root.querySelector('select#f-p') as HTMLSelectElement;
    const o6 = Array.from(sel.options).filter(o => o.value === '6')[0];
    expect(o6.disabled).toBe(true); expect(o6.textContent).toContain(`звіт від ${dmy('2026-10-02')} на погодженні`);
    Array.from(sel.options).filter(o => o.value !== '6').forEach(o => expect(o.disabled).toBe(false));
    expect(sel.value).not.toBe('6');
    expect(root.querySelector('.note.lock')).toBeNull();
  });
  test('#51 проект с отчётом на погодженні всё же подставлен — пояснение сразу, сохранение заблокировано', async () => {
    const created: any[] = [];
    const c2 = { ...ctx, repo: { fresh: async () => { throw new Error('не должно дойти до записи'); }, createIn: async (...a: any[]) => { created.push(a); return 1; } } };
    for (const pid of [6, 0]) {   // из карточки (прямая ссылка) и когда все проекты уже на погодженні
      const ps = pid ? two : [two[1]];
      mount(<ReportForm data={data(ps)} projectId={pid} onCancel={() => undefined} />, c2);
      const lock = root.querySelector('.note.lock') as HTMLElement;
      expect(lock).not.toBeNull(); expect(lock.textContent).toContain(dmy('2026-10-02'));
      await act(async () => { Simulate.submit(root.querySelector('form') as HTMLFormElement); await Promise.resolve(); });
      expect(created).toEqual([]);
      expect(root.querySelector('p.err, .err')!.textContent).toContain('на погодженні');
      act(() => { disposeRoot(root); });
    }
  });
  test('#52 «Завершено» — 100 и поле закрыто; другой статус — прежнее значение и поле открыто; «Скасовано» — без изменений', () => {
    mount(<ReportForm data={data([proj({ progress: 55 })])} projectId={5} onCancel={() => undefined} />);
    const pr = (): HTMLInputElement => root.querySelector('#f-pr') as HTMLInputElement;
    const st = (v: string): void => { act(() => { Simulate.change(root.querySelector('#f-st') as HTMLSelectElement, { target: { value: v } } as any); }); };
    expect([pr().value, pr().disabled]).toEqual(['55', false]);
    st('Завершено'); expect([pr().value, pr().disabled]).toEqual(['100', true]);
    st('Реалізація'); expect([pr().value, pr().disabled]).toEqual(['55', false]);
    st('Скасовано'); expect([pr().value, pr().disabled]).toEqual(['55', false]);
  });
  test.each([['00098', '98'], ['000', '0'], ['100', '100'], ['007', '7']])('#53 «%s» → при уходе с поля «%s»', (typed, shown) => {
    mount(<ReportForm data={data([proj()])} projectId={5} onCancel={() => undefined} />);
    const pr = root.querySelector('#f-pr') as HTMLInputElement;
    act(() => { Simulate.change(pr, { target: { value: typed } } as any); });
    act(() => { Simulate.blur(pr); });
    expect(pr.value).toBe(shown);
  });
  test.each(['500', '101', '1000'])('#53 «%s» — не заменяется на 100: ошибка у поля, отчёт не сохраняется', async typed => {
    const created: any[] = [];
    const c2 = { ...ctx, repo: { fresh: async () => ({}), createIn: async (...a: any[]) => { created.push(a); return 1; } } };
    mount(<ReportForm data={data([proj()])} projectId={5} onCancel={() => undefined} />, c2);
    const pr = root.querySelector('#f-pr') as HTMLInputElement;
    act(() => { Simulate.change(pr, { target: { value: typed } } as any); });
    act(() => { Simulate.blur(pr); });
    expect(pr.value).toBe(typed);
    await act(async () => { Simulate.submit(root.querySelector('form') as HTMLFormElement); await Promise.resolve(); });
    expect(pr.getAttribute('aria-invalid')).toBe('true');
    expect(pr.parentElement!.textContent).toContain(T.errProgress[0]);
    expect(created).toEqual([]);
  });
  test('#40 пустая форма — общее сообщение и подсветка всех незаполненных обязательных полей сразу', async () => {
    mount(<ReportForm data={data([proj()])} projectId={5} onCancel={() => undefined} />);
    act(() => { Simulate.change(root.querySelector('#f-st') as HTMLSelectElement, { target: { value: 'Призупинено' } } as any); });   // нужна причина
    await act(async () => { Simulate.submit(root.querySelector('form') as HTMLFormElement); await Promise.resolve(); });
    expect(root.querySelector('p.err, .err')!.textContent).toBe(T.errReqAll[0]);
    ['f-t', 'f-kr'].forEach(id => expect((root.querySelector('#' + id) as HTMLElement).getAttribute('aria-invalid')).toBe('true'));
    expect(root.querySelectorAll('.dims [aria-invalid="true"]').length).toBe(3);   // три оценки
  });
  test('#38 / #39 раскладка: статус, % и затраты — в одном ряду .fgrid-k; три оценки — в .dims', () => {
    mount(<ReportForm data={data([proj()])} projectId={5} onCancel={() => undefined} />);
    const row = root.querySelector('.fgrid-k') as HTMLElement;
    ['f-st', 'f-pr', 'f-c'].forEach(id => expect(row.querySelector('#' + id)).not.toBeNull());
    expect(root.querySelectorAll('.dims .ragpick').length).toBe(3);
  });
});

// #45: «Бюджет (план), $» — с пробелами между разрядами: у нового проекта — поле суммы, в карточке — только просмотр (1.7.7: меняет отчёт)
describe('#45 бюджет в форме проекта', () => {
  const data = { projects: [proj()], risks: [], reports: [], comments: [], team: [], canCreate: true, canApprove: true } as any;
  test('новый проект: ввод «2400000» — показ «2 400 000»', () => {
    mount(<ProjectForm data={data} onCancel={() => undefined} />);
    const b = root.querySelector('#f-bud') as HTMLInputElement;
    act(() => { Simulate.focus(b); }); act(() => { Simulate.change(b, { target: { value: '2400000' } } as any); }); act(() => { Simulate.blur(b); });
    expect(b.value).toBe('2 400 000');
  });
  test('правка карточки: бюджет показан с разрядами', () => {
    mount(<ProjectForm data={data} project={proj({ budget: 2400000 })} onCancel={() => undefined} />);
    expect((root.querySelector('#f-bud-fixed') as HTMLElement).textContent!.replace(/\s/g, ' ')).toBe('2 400 000 $');
  });
});

// #36: «Мої проєкти (усі)» и «Я PM» — и в «Архіві»
test('#36 «Архів»: «Я PM» — только где я PM; «Мої проєкти (усі)» — PM, власник, команда', () => {
  const me = 'a@x', pm = { id: 1, name: 'A', email: 'A@x' }, other = { id: 2, name: 'B', email: 'b@x' };
  const arch = (x: any): any => proj({ status: 'Завершено', ...x });
  expect(archiveView('pm', arch({ manager: pm }), me)).toBe(true);
  expect(archiveView('pm', arch({ manager: other, owner: pm }), me)).toBe(false);
  expect(archiveView('pm', arch({ manager: other, stakeholders: [pm] }), me)).toBe(false);
  expect(archiveView('mine', arch({ manager: other, owner: pm }), me)).toBe(true);
  expect(archiveView('mine', arch({ manager: other, stakeholders: [pm] }), me)).toBe(true);
  expect(archiveView('mine', arch({ manager: other }), me)).toBe(false);
});

// #32: «Ризики архівних проєктів» — на вкладке «Ризики», только просмотр
describe('#32 риски архивных проектов', () => {
  const risk = (id: number, projectId: number): any => ({ id, projectId, title: 'Ризик ' + id, type: 'Ризик', probability: 3, impact: 3, owner: null, status: 'Відкрито', due: '',
    mitigation: '', strategy: '', contingency: '', created: '2026-09-01T10:00:00Z' });
  const data = { projects: [proj({ id: 5, title: 'Активний' }), proj({ id: 6, title: 'Архівний', status: 'Завершено' })], risks: [risk(1, 5), risk(2, 6)], reports: [], comments: [], team: [],
    approvals: [], canCreate: false, canApprove: false } as any;
  const rows = (view: string): string[] => {
    mount(<Risks data={data} />, { ...ctx, views: { risks: view } });
    const r = Array.from(root.querySelectorAll('tbody tr')).map(tr => tr.textContent || '');
    act(() => { disposeRoot(root); }); return r;
  };
  test('вид «Ризики архівних проєктів» — только риски архива; остальные виды — без них', () => {
    const a = rows('archived'); expect(a.length).toBe(1); expect(a[0]).toContain('Ризик 2');
    for (const v of ['open', 'all']) { const r = rows(v); expect(r.some(x => x.indexOf('Ризик 2') >= 0)).toBe(false); expect(r.some(x => x.indexOf('Ризик 1') >= 0)).toBe(true); }
  });
  test('риск архивного проекта открывается только для просмотра (даже у PM с правами)', () => {
    mount(<RiskForm data={{ ...data, projects: [data.projects[0], { ...data.projects[1], canEdit: true }] }} projectId={6} riskId={2} onCancel={() => undefined} />);
    expect(root.querySelector('button[type="submit"]')).toBeNull();
    expect((root.querySelector('#k-status') as HTMLSelectElement).disabled).toBe(true);
  });
});

// Найдено сверкой 02.11.2026, исправлено #49: «на первую позицию не сдвигается ничего» (комментарий moveCol, прототип: i > 0), но moveCol первой незакреплённой
// колонки вниз (i = 0, j = 1) переставляет её — первой становится другая; в меню «↓» у первой колонки активна. Прототип — ничего не делает.
test(' #49 moveCol: первая колонка вниз не сдвигается (как в прототипе)', () => {
  const { moveCol } = require('../src/webparts/pmoPortal/logic/table');
  const st = { cols: ['strat', 'prio', 'title', 'type'], sort: null, filters: {} };
  expect(moveCol(st, 'strat', 1, 'title').cols).toEqual(['strat', 'prio', 'title', 'type']);
});
