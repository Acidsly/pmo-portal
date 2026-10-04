import cases from '../../tests/cases/apply.json';
import { reportTarget, roundAway } from '../src/webparts/pmoPortal/logic/overlay';

// Перенос отчёта в карточку — те же векторы, что у Get-ReportTarget синхронизации (Test-Scripts, раздел 3e)
describe('перенос погодженого отчёта в карточку (общие векторы с синхронизацией)', () => {
  for (const c of (cases as any).cases) test(c.name, () => {
    expect(reportTarget(c.rep, c.lastUpdate)).toEqual(c.out);
  });
});
test('округление сумм: x,5 — от нуля, как MidpointRounding.AwayFromZero', () => {
  expect([roundAway(12.5), roundAway(2.5), roundAway(12.4), roundAway(-2.5), roundAway(0)]).toEqual([13, 3, 12, -3, 0]);
});
test('applyPending переносит отчёт только через reportTarget', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/webparts/pmoPortal/logic/overlay.ts'), 'utf8');
  expect(src).toMatch(/const t = reportTarget\(/);
  expect(src).not.toMatch(/p\.status = r\.status/);
});
test('запись из приложения: затраты и бюджет — целые, x,5 — вверх', () => {
  const { reportBody, projectBody } = require('../src/webparts/pmoPortal/data/write');
  const { reportFromProject } = require('../src/webparts/pmoPortal/logic/forms');
  const p = { id: 1, status: 'Реалізація', type: 'Звичайний', progress: 0, start: '', goLive: '', planEnd: '', forecastEnd: '', actualCost: 0, priority: '' };
  expect(reportBody({ ...reportFromProject(p, '2026-10-04'), actualCost: 12.5 }, p).srActualCost).toBe(13);
  if (projectBody) expect(projectBody({ title: 'П', code: '', department: '', links: [], type: 'Звичайний', priority: '', manager: null, owner: null, team: [], start: '', goLive: '', planEnd: '', status: 'Ініціація', budget: 2.5, description: '' }, 'PRJ-001').pmBudget).toBe(3);
});
