/** @jest-environment jsdom */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { AppCtx } from '../src/webparts/pmoPortal/components/ctx';
import { makeT } from '../src/webparts/pmoPortal/i18n/i18n';
import { Home } from '../src/webparts/pmoPortal/pages/Home';
import { Projects } from '../src/webparts/pmoPortal/pages/Projects';
import { Support } from '../src/webparts/pmoPortal/pages/Support';
import { Reports } from '../src/webparts/pmoPortal/pages/Reports';
import { Risks } from '../src/webparts/pmoPortal/pages/Risks';
import { ReportForm } from '../src/webparts/pmoPortal/panels/ReportForm';
import { DEFAULT_VIEWS, parse, format, goRoute } from '../src/webparts/pmoPortal/logic/route';

// 1.7.12 «Підтримка» (SPEC 5.2): вкладки, главная в двух режимах, показатели ведут в список своей категории
const tt = makeT(0);
let views: any, went: [string, string][];
const ctx = (): any => ({ ...tt, lang: 0, today: '2026-11-12', me: 'pm@x', webUrl: '', views, go(p: string, v: string) { went.push([p, v]); },
  setView(k: string, v: string) { views = { ...views, [k]: v }; }, openProject() { /* */ }, openForm() { /* */ },
  repo: { loadChanges: async () => [], jobTitle: async () => '' }, canCreate: true, reload: async () => undefined, toast() { /* */ } });
let root: HTMLDivElement;
beforeEach(() => { root = document.createElement('div'); document.body.appendChild(root); localStorage.clear(); views = { ...DEFAULT_VIEWS }; went = []; });
afterEach(() => { ReactDOM.unmountComponentAtNode(root); root.remove(); });
const mount = (el: React.ReactElement): void => { act(() => { ReactDOM.render(<AppCtx.Provider value={ctx()}>{el}</AppCtx.Provider>, root); }); };
const pr = (x: any): any => ({ code: 'PRJ', status: 'Реалізація', type: 'Звичайний', priority: '2 — Середній', progress: 40, actualCost: 0, start: '2026-03-02', goLive: '',
  planEnd: '2027-12-01', forecastEnd: '', archivedAt: '', budget: 0, rag: 'Зелений', department: 'ІТ', country: 'Україна', lastUpdate: '2026-11-12', lastReport: '', lastComment: '',
  canEdit: true, manager: { id: 1, email: 'pm@x', name: 'PM' }, owner: null, stakeholders: [], team: [], links: [], description: '', pending: false, parent: null, lastRep: null, ...x });
const rep = (x: any): any => ({ date: '2026-11-12', approval: 'На погодженні', decision: false, decisionText: '', author: null, ...x });
const risk = (x: any): any => ({ title: 'R', type: 'Ризик', probability: 5, impact: 4, status: 'Відкрито', owner: null, due: '', ...x });
const DATA = (): any => ({
  projects: [pr({ id: 1, title: 'Поточний А', rag: 'Червоний' }), pr({ id: 2, title: 'Поточний Б', lastUpdate: '2026-11-05' }),
    pr({ id: 3, title: 'Підтримка В', status: 'Підтримка', lastUpdate: '2026-11-05', planEnd: '2026-11-30' }),
    pr({ id: 4, title: 'Підтримка Г', status: 'Підтримка', rag: 'Жовтий', planEnd: '2026-11-01' }),
    pr({ id: 5, title: 'Архівний Д', status: 'Завершено', archivedAt: '2026-10-01' })],
  reports: [rep({ id: 11, projectId: 1 }), rep({ id: 12, projectId: 3, decision: true, decisionText: 'Продовжити' }), rep({ id: 13, projectId: 4 })],
  risks: [risk({ id: 21, projectId: 1 }), risk({ id: 22, projectId: 3, type: 'Проблема' }), risk({ id: 23, projectId: 4, probability: 2, impact: 2 })],
  comments: [], changes: [], team: [], approvals: [], canCreate: true, canApprove: true });
const text = (): string => root.textContent || '';
const titles = (): string[] => Array.from(root.querySelectorAll('.tile-t, td button.link')).map(x => x.textContent || '');

describe('вкладки', () => {
  test('«Поточні проєкти» — без підтримки и архива; «Проєкти підтримки» — только фаза «Підтримка»', () => {
    mount(<Projects data={DATA()} />);
    expect(titles().sort()).toEqual(['Поточний А', 'Поточний Б']);
    mount(<Support data={DATA()} />);
    expect(titles().sort()).toEqual(['Підтримка В', 'Підтримка Г']);
    expect(text()).toContain('Статус-звіт — щочетверга');
  });
  test('нет проектов підтримки — подсказка, как перевести проект', () => {
    mount(<Support data={{ ...DATA(), projects: DATA().projects.filter((p: any) => p.status !== 'Підтримка') }} />);
    expect(text()).toContain('«Фаза проєкту» — «Підтримка»');
  });
  test('маршрут: #support/stale, режим главной в адресе #home/support; из шапки главная — в прежнем режиме', () => {
    const r = parse('#support/stale', DEFAULT_VIEWS);
    expect(r.page).toBe('support'); expect(r.views.support).toBe('stale'); expect(format(r)).toBe('#support/stale');
    const h = parse('#home/support', DEFAULT_VIEWS); expect(h.views.home).toBe('support'); expect(format(h)).toBe('#home/support');
    expect(goRoute(goRoute(h, 'support', 'late'), 'home').views.home).toBe('support');
    expect(goRoute(goRoute(h, 'support', 'late'), 'support').views.support).toBe('all');
    // ревью: назад браузера с #home/support на #home — режим поточні; из шапки — запомненный режим и точный адрес
    expect(parse('#home', h.views).views.home).toBe('cur');
    expect(format(goRoute(goRoute(h, 'reports'), 'home'))).toBe('#home/support');
  });
  test('форма статус-звіту предлагает фазу «Підтримка»', () => {
    mount(<ReportForm data={DATA()} projectId={1} onCancel={() => undefined} />);
    const opts = Array.from((root.querySelector('#f-st') as HTMLSelectElement).options).map(o => o.value);
    expect(opts).toContain('Підтримка');
  });
});

describe('главная: два режима', () => {
  const kpi = (): { n: string; label: string; el: HTMLElement }[] => Array.from(root.querySelectorAll('.kpis .kpi')).map(b =>
    ({ n: b.querySelector('b')!.textContent || '', label: b.querySelector('.kl')!.textContent || '', el: b as HTMLElement }));
  test('по умолчанию — поточні: только свои проекты; переключатель — режим підтримки и запоминание', () => {
    mount(<Home data={DATA()} />);
    expect(kpi()[0]).toMatchObject({ n: '2', label: 'Активні проєкти' });
    // «Звіт вчасно» — только без пропусков: А — сегодня (зел.), Б — пропущен пн 09.11 (жёлт.)
    expect(kpi()[1].n).toBe('50%'); expect(root.querySelector('.kpis .kpi small')!.textContent).toBe('1 з 2');
    expect(text()).toContain('Найбільші зсуви термінів'); expect(text()).not.toContain('Період підтримки:');
    const seg = Array.from(root.querySelectorAll('.home-seg button')) as HTMLElement[];
    expect(seg.map(b => b.textContent)).toEqual(['Поточні проєкти 2', 'Проєкти підтримки 2']);
    act(() => { Simulate.click(seg[1]); });
    expect(views.home).toBe('support'); expect(localStorage.getItem('pmo-homeseg')).toBe('sup');
    mount(<Home data={DATA()} />);
    expect(kpi()[0]).toMatchObject({ n: '2', label: 'На підтримці' });
    expect(text()).toContain('Період підтримки: минув або спливає за 30 днів'); expect(text()).not.toContain('Найбільші зсуви термінів');
    // «Проблемні» — только проекты підтримки
    expect(text()).toContain('Підтримка Г'); expect(text()).not.toContain('Поточний А');
  });
  // ревью 09.11: число на плитке = строки списка, куда она ведёт (класс ошибки «режим считает своё, список — всё»)
  for (const mode of ['cur', 'support']) test(`плитки (${mode}) ведут в список своей категории с тем же числом строк`, () => {
    views.home = mode;
    mount(<Home data={DATA()} />);
    const tiles = kpi().filter(x => !/%|—/.test(x.n));
    expect(tiles.length).toBeGreaterThanOrEqual(4);
    for (const x of tiles) {
      went = [];
      act(() => { Simulate.click(x.el); });
      const [page, view] = went[0];
      views = { ...DEFAULT_VIEWS, [page]: view };
      const el = page === 'projects' ? <Projects data={DATA()} /> : page === 'support' ? <Support data={DATA()} />
        : page === 'reports' ? <Reports data={DATA()} /> : <Risks data={DATA()} />;
      mount(el);
      const rows = page === 'projects' || page === 'support' ? root.querySelectorAll('.tile').length : root.querySelectorAll('table tbody tr').length;
      expect(`${x.label}: ${rows}`).toBe(`${x.label}: ${x.n}`);
      views = { ...DEFAULT_VIEWS, home: mode }; mount(<Home data={DATA()} />);
    }
  });
});
