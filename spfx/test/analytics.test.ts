import { kpis, riskMatrix, slips, launches, byDept } from '../src/webparts/pmoPortal/logic/analytics';
import { Project, StatusReport, Risk, ChangeEntry } from '../src/webparts/pmoPortal/data/types';

const today = '2026-09-28';
const me = { id: 1, name: 'PM', email: 'pm@x.ua' };
const P = (x: Partial<Project>): Project => ({ id: 1, code: '', title: 'P', type: 'Звичайний', priority: '', manager: me, owner: null, stakeholders: [],
  department: 'ІТ', status: 'Реалізація', rag: 'Зелений', progress: 0, start: '', goLive: '', planEnd: '', forecastEnd: '', archivedAt: '', budget: 0,
  actualCost: 0, lastUpdate: '2026-09-25', lastReport: '', lastComment: '', links: [], team: [], description: '', canEdit: true, pending: false, ...x });
const R = (x: Partial<StatusReport>): StatusReport => ({ id: 1, projectId: 1, date: '2026-09-20', period: '', periodFrom: '', schedule: 'Зелений', budget: 'Зелений', resources: 'Зелений',
  status: '', type: '', progress: null, start: '', goLive: '', planEnd: '', forecastEnd: '', actualCost: null, keyReason: '', title: 'T', done: '', next: '', issues: '',
  decision: false, decisionText: '', applied: true, author: me, approval: 'Погоджено', approvedBy: null, approvedAt: '', approvalNote: '', ...x });
const K = (x: Partial<Risk>): Risk => ({ id: 1, projectId: 1, title: 'K', type: 'Ризик', probability: 3, impact: 3, owner: null, status: 'Відкритий', due: '',
  mitigation: '', strategy: '', contingency: '', ...x });

const projects = [
  P({ id: 1, lastUpdate: '2026-09-25', planEnd: '2026-09-01', forecastEnd: '2026-10-31', goLive: '2026-10-10', rag: 'Червоний' }),
  P({ id: 2, lastUpdate: '2026-09-01', department: 'Фінанси', planEnd: '2026-12-01', forecastEnd: '2026-12-11', goLive: '2026-11-15', rag: 'Жовтий' }),
  P({ id: 3, lastUpdate: '', status: 'Ініціація', rag: '', goLive: today, manager: { id: 2, name: 'O', email: 'o@x' } }),
  P({ id: 4, status: 'Архівний', planEnd: '2026-01-01' })];

test('kpis: активні, свіжі, погодження, високі ризики, прострочені', () => {
  const reps = [R({ id: 1, approval: 'На погодженні' }), R({ id: 2, projectId: 9, approval: 'На погодженні' }), R({ id: 3 })];
  const risks = [K({ id: 1, probability: 5, impact: 3 }), K({ id: 2, probability: 5, impact: 5, status: 'Закрито' }), K({ id: 3, projectId: 9, probability: 5, impact: 5 })];
  expect(kpis(projects, reps, risks, today)).toEqual({ active: 3, fresh: 1, freshPct: 33, awaiting: 1, highRisks: 1, overdue: 1 });
});
test('riskMatrix: відкриті ризики за ймовірністю × впливом', () => {
  const m = riskMatrix(projects, [K({ id: 1, probability: 5, impact: 3 }), K({ id: 2, probability: 5, impact: 3 }), K({ id: 3, status: 'Закрито' }), K({ id: 4, projectId: 9 })]);
  expect(m[4][2].map(k => k.id)).toEqual([1, 2]);
  expect(m[2][2]).toHaveLength(0);
});
test('slips: прогноз пізніше плану, топ за днями, кількість перенесень', () => {
  const ch = [{ projectId: 1, field: 'pmPlanEnd', kind: 'Статус-звіт' }, { projectId: 1, field: 'pmPlanEnd', kind: 'Статус-звіт' }, { projectId: 2, field: 'pmGoLive', kind: 'Статус-звіт' }] as ChangeEntry[];
  expect(slips(projects, ch).map(s => [s.p.id, s.days, s.moves])).toEqual([[1, 60, 2], [2, 10, 0]]);
});
test('launches: від сьогодні до +7 днів (тиждень)', () => {
  expect(launches(projects, today).map(p => p.id)).toEqual([3]);
  const edge = [P({ id: 7, goLive: '2026-10-05' }), P({ id: 8, goLive: '2026-10-06' }), P({ id: 9, goLive: '2026-09-27' })];
  expect(launches(edge, today).map(p => p.id)).toEqual([7]);
});
test('byDept: активні, розбивка за станом', () => {
  expect(byDept(projects)).toEqual([{ dept: 'ІТ', g: 0, y: 0, r: 1, na: 1, total: 2 }, { dept: 'Фінанси', g: 0, y: 1, r: 0, na: 0, total: 1 }]);
});

test('slips: відфільтрований при завантаженні журнал (лише pmPlanEnd) дає той самий результат, що й повний', () => {
  const full = [{ projectId: 1, field: 'pmPlanEnd', kind: 'Статус-звіт' }, { projectId: 1, field: 'pmProgress', kind: 'Статус-звіт' },
    { projectId: 1, field: 'pmPlanEnd', kind: 'Статус-звіт' }, { projectId: 2, field: 'pmStatus', kind: 'Статус-звіт' }] as ChangeEntry[];
  expect(slips(projects, full.filter(c => c.field === 'pmPlanEnd'))).toEqual(slips(projects, full));
});
