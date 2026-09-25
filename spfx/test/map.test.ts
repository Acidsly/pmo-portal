import projectRaw from './fixtures/project.json';
import reportRaw from './fixtures/report.json';
import { mapProject, mapReport, mapRisk, canEdit } from '../src/webparts/pmoPortal/data/map';

test('mapProject', () => {
  const p = mapProject(projectRaw);
  expect(p).toMatchObject({ id: 7, code: 'PRJ-007', type: 'Стратегічний', status: 'Реалізація', rag: 'Червоний', progress: 35,
    start: '2026-04-27', planEnd: '2026-11-08', goLive: '', lastUpdate: '2026-09-19', loop: 'https://loop.cloud.microsoft/p/x',
    budget: 1800000, actualCost: 1350000, lastComment: '', canEdit: true, pending: false });
  expect(p.manager).toEqual({ id: 11, name: 'Test Kovalenko', email: 'test.kovalenko@smarthr.kz' });
  expect(p.owner).toBeNull(); expect(p.stakeholders).toHaveLength(1);
});
test('mapReport', () => {
  expect(mapReport(reportRaw)).toMatchObject({ id: 3, projectId: 7, date: '2026-09-19', schedule: 'Червоний', status: '',
    progress: 35, actualCost: null, forecastEnd: '2027-01-12', decision: true, applied: false, next: '' });
});
test('mapRisk', () => {
  expect(mapRisk({ Id: 5, Title: 'Р', riProjectId: 7, riType: 'Ризик', riProbability: 4, riImpact: 5, riStatus: 'Відкрито',
    riDue: '2026-10-01T12:00:00Z', riMitigation: null, riOwner: null }))
    .toEqual({ id: 5, projectId: 7, title: 'Р', type: 'Ризик', probability: 4, impact: 5, owner: null, status: 'Відкрито', due: '2026-10-01', mitigation: '', created: '' });
});
test('canEdit: бит EditListItems (0x4) в Low', () => {
  expect(canEdit({ High: '176', Low: '138612833' })).toBe(false);   // «Читання»
  expect(canEdit({ High: '432', Low: '1011028719' })).toBe(true);   // «Редагування»
  expect(canEdit(undefined)).toBe(false);
});
