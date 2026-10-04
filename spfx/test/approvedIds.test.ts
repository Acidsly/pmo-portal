import cases from '../../tests/cases/reports.json';
import { effectiveApproval, approvedIds, pendingReports } from '../src/webparts/pmoPortal/logic/approval';
import { StatusReport, Approval } from '../src/webparts/pmoPortal/data/types';

// Какое решение PMO действует — те же векторы, что у Get-EffectiveApproval синхронизации (tests/Test-Scripts.ps1, раздел 3e)
describe('действующее решение PMO (общие векторы с синхронизацией)', () => {
  for (const c of (cases as any).effective) test(c.name, () => {
    const e = effectiveApproval(c.rep, c.aps);
    expect(e ? `${e.id}:${e.decision}` : '-').toBe(c.out ? `${c.out.id}:${c.out.decision}` : '-');
  });
});

const rep = (x: Partial<StatusReport>): StatusReport => ({ id: 1, projectId: 5, date: '2026-10-01', schedule: 'Зелений', budget: 'Зелений', resources: 'Жовтий', approval: 'На погодженні', applied: false, ...x } as StatusReport);
const ap = (x: Partial<Approval>): Approval => ({ id: 1, reportId: 1, projectId: 5, decision: 'Погоджено', s: '', b: '', r: '', note: '', author: null, created: '', applied: true, ...x } as Approval);
test('ошибка кросс-сверки №1: «Погоджено» с недействительной записью решения (смена оценки без комментария) не подтверждено', () => {
  expect(approvedIds([rep({ approval: 'Погоджено' })], [ap({ b: 'Червоний' })])).toEqual({});
  expect(approvedIds([rep({ approval: 'Погоджено' })], [ap({})])).toEqual({ 1: true });
  expect(approvedIds([rep({ approval: 'Погоджено' })], [ap({ id: 1, decision: 'Повернуто', note: 'x' }), ap({ id: 2 })])).toEqual({});   // R10
  expect(approvedIds([rep({ approval: 'Погоджено' })], [ap({ projectId: 6 })])).toEqual({});                                             // R6
});
test('#29 / #51 отчёты на погодженні: без решения и не применённые, по дате и номеру', () => {
  const rs = [rep({ id: 3, date: '2026-10-02' }), rep({ id: 2, date: '2026-10-01' }), rep({ id: 1, date: '2026-10-01' }),
    rep({ id: 4, approval: 'Погоджено' }), rep({ id: 5, approval: 'Повернуто' }), rep({ id: 6, applied: true }), rep({ id: 7, approval: '' })];
  expect(pendingReports(rs).map(r => r.id)).toEqual([1, 2, 7, 3]);   // 7 — пустое состояние (старые данные) = на погодженні; одна дата — по номеру
});
// место вызова: приложение берёт «Погоджено» и «на погодженні» только из общих правил (а не собственной копии условия)
test('SpRepo использует общие правила approvedIds и pendingReports', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/webparts/pmoPortal/data/SpRepo.ts'), 'utf8');
  expect((src.match(/approvedOf\(reports, approvals\)/g) || []).length).toBe(2);   // loadAll и fresh
  expect(src).not.toMatch(/decision === 'Погоджено'/);
  expect(src).not.toMatch(/approval === 'На погодженні'/);
  expect((src.match(/pendingReports\(/g) || []).length).toBeGreaterThanOrEqual(2);
});
