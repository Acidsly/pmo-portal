/** @jest-environment jsdom */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { AppCtx } from '../src/webparts/pmoPortal/components/ctx';
import { ProjectForm } from '../src/webparts/pmoPortal/panels/ProjectForm';
import { ProjectCard } from '../src/webparts/pmoPortal/panels/ProjectCard';
import { ReportView } from '../src/webparts/pmoPortal/panels/ReportView';
import { projectDefs } from '../src/webparts/pmoPortal/components/defs';
import { makeT } from '../src/webparts/pmoPortal/i18n/i18n';
import { reportFromReturned, switchProject, reportFromProject } from '../src/webparts/pmoPortal/logic/forms';

// 1.7.7 в интерфейсе: карточка (прогноз и отклонение), форма карточки (бюджет — только чтение), просмотр отчёта (було → стало, «Не зроблено»),
// колонка «Прогноз витрат», черновик на основе повернутого и смена проекта
const tt = makeT(0);
const ctx: any = { ...tt, lang: 0, today: '2026-10-21', me: 'pm@x', webUrl: '', views: {}, go() { /* */ }, setView() { /* */ }, openForm() { /* */ },
  openProject() { /* */ }, canCreate: true, reload: async () => undefined, toast() { /* */ },
  repo: { create: async () => 50, createIn: async () => 1, loadChanges: async () => [], jobTitle: async () => '' } };
const pj = (x: any = {}): any => ({ id: 1, code: 'PRJ-001', title: 'Проєкт', type: 'Звичайний', priority: '2 — Середній', status: 'Реалізація', department: 'ІТ',
  manager: { id: 1, email: 'pm@x', name: 'PM' }, owner: null, stakeholders: [], team: [], links: [], budget: 95000, forecastCost: 120000, description: 'опис', canEdit: true, rag: '',
  progress: 40, start: '', goLive: '', planEnd: '', forecastEnd: '', archivedAt: '', actualCost: 71000, lastUpdate: '', lastReport: '', lastComment: '', pending: false, parent: null, ...x });
let root: HTMLDivElement;
beforeEach(() => { root = document.createElement('div'); document.body.appendChild(root); });
afterEach(() => { ReactDOM.unmountComponentAtNode(root); root.remove(); });
const mount = (el: React.ReactElement): void => { act(() => { ReactDOM.render(<AppCtx.Provider value={ctx}>{el}</AppCtx.Provider>, root); }); };
const data = (p: any, reports: any[] = []): any => ({ projects: [p], reports, risks: [], comments: [], changes: [], team: [], approvals: [], canCreate: true, canApprove: true });
const txt = (): string => (root.textContent || '').replace(/[  ]/g, ' ');

test('карточка: прогноз витрат и перевитрата «+25 000 $ (26%)»; економія — «−»; без прогнозу — порожньо', async () => {
  await act(async () => { ReactDOM.render(<AppCtx.Provider value={ctx}><ProjectCard project={pj()} data={data(pj())} repo={ctx.repo} onClose={() => undefined} /></AppCtx.Provider>, root); });
  expect(txt()).toContain('Прогноз витрат на завершення');
  expect(txt()).toContain('120 000 $');
  expect(txt()).toContain('+25 000 $ (26%)');
  ReactDOM.unmountComponentAtNode(root);
  await act(async () => { ReactDOM.render(<AppCtx.Provider value={ctx}><ProjectCard project={pj({ forecastCost: 90000 })} data={data(pj({ forecastCost: 90000 }))} repo={ctx.repo} onClose={() => undefined} /></AppCtx.Provider>, root); });
  expect(txt()).toContain('−5 000 $');
});
test('форма карточки: бюджет — только чтение с подсказкой; у нового проекта — поле ввода', () => {
  mount(<ProjectForm data={data(pj())} project={pj()} onCancel={() => undefined} />);
  expect(root.querySelector('#f-bud')).toBeNull();
  expect((root.querySelector('#f-bud-fixed') as HTMLElement).textContent!.replace(/[  ]/g, ' ')).toBe('95 000 $');
  expect(txt()).toContain('Бюджет (план) змінюється статус-звітом');
  ReactDOM.unmountComponentAtNode(root);
  mount(<ProjectForm data={data(pj())} onCancel={() => undefined} />);
  expect(root.querySelector('#f-bud')).not.toBeNull();
});
test('просмотр отчёта на погодженні: бюджет і прогноз «було → стало», «Не зроблено з плану»', async () => {
  const r: any = { id: 7, projectId: 1, date: '2026-10-21', title: 'Звіт', approval: 'На погодженні', applied: false, author: { id: 1, email: 'pm@x', name: 'PM' },
    schedule: 'Зелений', budget: 'Жовтий', resources: 'Зелений', status: 'Реалізація', type: '', progress: null, start: '', goLive: '', planEnd: '', forecastEnd: '', actualCost: null,
    budgetPlan: 110000, forecastCost: 130000, notDone: 'UAT не зроблено', keyReason: 'Ліцензія', done: '', next: '', issues: '', decision: false, decisionText: '' };
  await act(async () => { ReactDOM.render(<AppCtx.Provider value={ctx}><ReportView data={data(pj(), [r])} report={r} onCancel={() => undefined} /></AppCtx.Provider>, root); });
  const s = txt();
  expect(s).toMatch(/Бюджет \(план\)\s*95 000 \$→110 000 \$/);
  expect(s).toMatch(/Прогноз витрат на завершення\s*120 000 \$→130 000 \$/);
  expect(s).toContain('Не зроблено з плану і чому: UAT не зроблено');
});
test('колонка «Прогноз витрат»: сумма; не задан — «—»; сортировка по сумме', () => {
  const defs = projectDefs({ ...tt, today: '2026-10-21', byId: {}, comments: [], open() { /* */ }, openRisk() { /* */ }, openReport() { /* */ } } as any, false);
  const col: any = (defs as any).cols ? (defs as any).cols.fcost : (defs as any).fcost;
  expect(col).toBeDefined();
  mount(<>{col.cell(pj())}</>); expect(txt()).toBe('120 000 $');
  ReactDOM.unmountComponentAtNode(root);
  mount(<>{col.cell(pj({ forecastCost: null }))}</>); expect(txt()).toBe('—');
  expect(col.sort(pj())).toBe(120000);
});
test('черновик: на основе повернутого — бюджет, прогноз и «Не зроблено» из него; смена проекта — план нового проекта', () => {
  const p = pj();
  const ret: any = { id: 9, projectId: 1, date: '2026-10-20', approval: 'Повернуто', schedule: 'Зелений', budget: 'Зелений', resources: 'Зелений', status: '', type: '', progress: null,
    start: '', goLive: '', planEnd: '', forecastEnd: '', actualCost: null, budgetPlan: 100000, forecastCost: 125000, notDone: 'API не надано', title: 'Т', done: '', next: '', issues: '',
    decision: false, decisionText: '', keyReason: 'К' };
  const d = reportFromReturned(ret, p, '2026-10-21');
  expect([d.budgetPlan, d.forecastCost, d.notDone]).toEqual([100000, 125000, 'API не надано']);
  const old = reportFromReturned({ ...ret, budgetPlan: null, forecastCost: null, notDone: undefined }, p, '2026-10-21');
  expect([old.budgetPlan, old.forecastCost, old.notDone]).toEqual([95000, 120000, '']);   // старый отчёт без полей — из карточки
  const sw = switchProject({ ...reportFromProject(p, '2026-10-21'), notDone: 'введене' }, pj({ id: 2, budget: 50000, forecastCost: null }), { text: 'План проєкту 2', date: '2026-10-01' });
  expect([sw.budgetPlan, sw.forecastCost, sw.planned, sw.notDone]).toEqual([50000, 0, 'План проєкту 2', 'введене']);
});
