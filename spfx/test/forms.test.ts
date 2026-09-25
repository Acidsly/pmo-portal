import { nextCode, reportFromProject, keyChanged, validateReport, validateProject, validateRisk, cardDiff, ReportDraft, ProjectDraft, RiskDraft }
  from '../src/webparts/pmoPortal/logic/forms';
import { Project } from '../src/webparts/pmoPortal/data/types';

const P = (x: Partial<Project>): Project => ({ id: 1, code: '', title: 'P', type: 'Звичайний', priority: '', manager: null, owner: null, stakeholders: [],
  department: '', status: 'Реалізація', rag: '', progress: 0, start: '', goLive: '', planEnd: '', forecastEnd: '', archivedAt: '', budget: 0,
  actualCost: 0, lastUpdate: '', lastReport: '', lastComment: '', loop: '', description: '', canEdit: false, pending: false, ...x });
const p = P({ status: 'Реалізація', type: 'Звичайний', progress: 40, planEnd: '2026-12-01', actualCost: 100 });
const draft = (x: Partial<ProjectDraft>): ProjectDraft => ({ title: '', code: '', department: 'ІТ', loop: '', type: 'Звичайний', priority: '2 — Середній',
  manager: null, owner: null, stakeholders: [], start: '', goLive: '', planEnd: '', status: 'Ініціація', budget: 0, description: '', ...x });

test('nextCode: максимальный PRJ + 1, трёхзначный', () => {
  expect(nextCode(['PRJ-001', 'PRJ-012', 'TEST-99', ''])).toBe('PRJ-013');
  expect(nextCode([])).toBe('PRJ-001');
  expect(nextCode(['PRJ-099'])).toBe('PRJ-100');
});
test('подстановка и «изменились ли показатели» (как keyChanged прототипа)', () => {
  const d = reportFromProject(p, '2026-09-26');
  expect(d).toMatchObject({ projectId: 1, date: '2026-09-26', period: '2 тижні', status: 'Реалізація', progress: 40, planEnd: '2026-12-01', actualCost: 100 });
  expect(keyChanged(d, p)).toBe(false);
  expect(keyChanged({ ...d, progress: 60, actualCost: 500 }, p)).toBe(false);   // % и затраты причины не требуют
  expect(keyChanged({ ...d, planEnd: '2027-01-15' }, p)).toBe(true);
  expect(keyChanged({ ...d, type: 'Стратегічний' }, p)).toBe(true);
});
test('проверки отчёта в порядке прототипа', () => {
  const ok: ReportDraft = { ...reportFromProject(p, '2026-09-26'), schedule: 'Зелений', budget: 'Зелений', resources: 'Жовтий', title: 'Резюме' };
  expect(validateReport({ ...ok, resources: '' }, p)).toBe('errDims');
  expect(validateReport({ ...ok, title: ' ' }, p)).toBe('errSum');
  expect(validateReport({ ...ok, date: '' }, p)).toBe('errDate');
  expect(validateReport({ ...ok, status: 'Призупинено' }, p)).toBe('errKeyReason');
  expect(validateReport({ ...ok, status: 'Призупинено', keyReason: 'Пауза' }, p)).toBe('');
  expect(validateReport(ok, p)).toBe('');
});
test('проверки проекта и риска', () => {
  expect(validateProject(draft({ title: '' }))).toBe('errTitle');
  expect(validateProject(draft({ title: 'П' }))).toBe('errPM');
  expect(validateProject(draft({ title: 'П', manager: { id: 1, name: 'M', email: 'm@x.ua' } }))).toBe('');
  const r: RiskDraft = { projectId: 1, title: ' ', type: 'Ризик', probability: 3, impact: 3, owner: null, status: 'Відкрито', due: '', mitigation: '' };
  expect(validateRisk(r)).toBe('errRiskTitle');
  expect(validateRisk({ ...r, title: 'Р' })).toBe('');
});
test('правка карточки: изменения без описания', () => {
  const before = P({ title: 'А', priority: '2 — Середній', department: 'ІТ', description: 'старое' });
  const diff = cardDiff(before, draft({ title: 'Б', priority: '1 — Високий', description: 'новое' }));
  expect(diff).toEqual([{ f: 'title', from: 'А', to: 'Б' }, { f: 'prio', from: '2 — Середній', to: '1 — Високий' }]);
});
