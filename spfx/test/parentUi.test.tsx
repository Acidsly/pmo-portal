/** @jest-environment jsdom */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { AppCtx } from '../src/webparts/pmoPortal/components/ctx';
import { ProjectForm } from '../src/webparts/pmoPortal/panels/ProjectForm';
import { ProjectCard } from '../src/webparts/pmoPortal/panels/ProjectCard';
import { DataTable } from '../src/webparts/pmoPortal/components/DataTable';
import { projectDefs } from '../src/webparts/pmoPortal/components/defs';
import { makeT } from '../src/webparts/pmoPortal/i18n/i18n';

// «Батьківський проєкт» в интерфейсе: варианты в форме, запись, карточка, колонка
const tt = makeT(0);
const opened: number[] = [];
const ctx: any = { ...tt, lang: 0, today: '2026-10-19', me: 'pm@x', webUrl: '', views: {}, go() { /* */ }, setView() { /* */ }, openForm() { /* */ },
  openProject: (id: number) => opened.push(id), canCreate: true, reload: async () => undefined, toast() { /* */ },
  repo: { create: async () => 50, createIn: async () => 1, loadChanges: async () => [], jobTitle: async () => '' } };
const pj = (id: number, parent: number, x: any = {}): any => ({ id, code: 'PRJ-00' + id, title: 'Проєкт ' + id, type: 'Звичайний', priority: '2 — Середній', status: 'Реалізація',
  department: 'ІТ', manager: { id: 1, email: 'pm@x', name: 'PM' }, owner: null, stakeholders: [], team: [], links: [], budget: 0, description: 'опис', canEdit: true, rag: '',
  progress: 0, start: '', goLive: '', planEnd: '', forecastEnd: '', archivedAt: '', actualCost: 0, lastUpdate: '', lastReport: '', lastComment: '', pending: false,
  parent: parent ? { id: parent, title: 'Проєкт ' + parent, code: 'PRJ-00' + parent } : null, ...x });
// 1 → 2 → 3, 4 — отдельно (архив)
const projects = [pj(1, 0), pj(2, 1), pj(3, 2), pj(4, 0, { status: 'Завершено' })];
const data: any = { projects, reports: [], risks: [], comments: [], changes: [], team: [], canCreate: true, canApprove: true };
let root: HTMLDivElement;
beforeEach(() => { root = document.createElement('div'); document.body.appendChild(root); opened.length = 0; });
afterEach(() => { ReactDOM.unmountComponentAtNode(root); root.remove(); });
const mount = (el: React.ReactElement): void => { act(() => { ReactDOM.render(<AppCtx.Provider value={ctx}>{el}</AppCtx.Provider>, root); }); };
const options = (): string[] => Array.from((root.querySelector('#f-parent') as HTMLSelectElement).options).map(o => o.textContent || '');

describe('форма проекта', () => {
  test('правка: без себя и своих дочерних на любой глубине; архивный — можно; текущий родитель выбран', () => {
    mount(<ProjectForm data={data} project={projects[1]} onCancel={() => undefined} />);
    expect(options()).toEqual(['— не вказано —', 'PRJ-001 · Проєкт 1', 'PRJ-004 · Проєкт 4']);
    expect((root.querySelector('#f-parent') as HTMLSelectElement).value).toBe('1');
    expect(root.textContent).toContain('Лише для зв\'язку проєктів; прав не дає.');
  });
  test('родитель, которого человек не видит, остаётся в списке (без кода — название из записи)', () => {
    const hidden = pj(5, 0, { parent: { id: 99, title: 'Чужий проєкт' } });
    mount(<ProjectForm data={{ ...data, projects: [...projects, hidden] }} project={hidden} onCancel={() => undefined} />);
    expect(options()[1]).toBe('Чужий проєкт');
    expect((root.querySelector('#f-parent') as HTMLSelectElement).value).toBe('99');
  });
  test('новый проект: все проекты, архивные тоже (запись pmParentId — в parentData.test.ts)', () => {
    mount(<ProjectForm data={data} onCancel={() => undefined} />);
    expect(options()).toEqual(['— не вказано —', 'PRJ-001 · Проєкт 1', 'PRJ-002 · Проєкт 2', 'PRJ-003 · Проєкт 3', 'PRJ-004 · Проєкт 4']);
    act(() => { Simulate.change(root.querySelector('#f-parent') as HTMLSelectElement, { target: { value: '3' } } as any); });
    expect((root.querySelector('#f-parent') as HTMLSelectElement).value).toBe('3');
  });
});

describe('карточка', () => {
  test('родитель — ссылкой, дочерние — списком; нажатие открывает проект', () => {
    mount(<ProjectCard project={projects[1]} data={data} repo={ctx.repo} onClose={() => undefined} />);
    const sec = root.querySelector('#card-parent') as HTMLElement;
    expect(sec.textContent).toContain('Батьківський проєктPRJ-001 · Проєкт 1');
    expect(sec.textContent).toContain('Дочірні проєкти (1)PRJ-003 · Проєкт 3');
    act(() => { (sec.querySelectorAll('button.link')[0] as HTMLElement).click(); });
    act(() => { (sec.querySelectorAll('button.link')[1] as HTMLElement).click(); });
    expect(opened).toEqual([1, 3]);
  });
  test('родитель не виден — название без ссылки; нет связей — блока нет', () => {
    mount(<ProjectCard project={pj(5, 0, { parent: { id: 99, title: 'Чужий проєкт' } })} data={data} repo={ctx.repo} onClose={() => undefined} />);
    expect((root.querySelector('#card-parent') as HTMLElement).querySelector('button')).toBeNull();
    expect((root.querySelector('#card-parent') as HTMLElement).textContent).toContain('Чужий проєкт');
    ReactDOM.unmountComponentAtNode(root);
    mount(<ProjectCard project={projects[3]} data={data} repo={ctx.repo} onClose={() => undefined} />);
    expect(root.querySelector('#card-parent')).toBeNull();
  });
});

describe('колонка «Батьківський проєкт» в «Проєкти»', () => {
  test('видимый родитель — ссылкой, «PRJ-001 · Проєкт 1»; нет — «—»', () => {
    const byId: any = {}; projects.forEach(p => { byId[p.id] = p; });
    const defs = projectDefs({ t: tt.t, fl: tt.fl, today: '2026-10-19', byId, comments: [], open: (id: number) => opened.push(id), openRisk() { /* */ }, openReport() { /* */ } } as any, false);
    expect(defs.defaults).not.toContain('parent');
    mount(<DataTable tkey="tp" defs={{ ...defs, defaults: ['title', 'parent'] }} rows={projects} />);
    const cells = Array.from(root.querySelectorAll('tbody tr')).map(tr => (tr.children[1] as HTMLElement).textContent);
    expect(cells).toEqual(['—', 'PRJ-001 · Проєкт 1', 'PRJ-002 · Проєкт 2', '—']);
  });
});
